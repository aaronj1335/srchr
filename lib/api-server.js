var fs = require('fs');
var _ = require('lodash');
var Q = require('q');
var moment = require('moment');
var connect = require('connect');
var solr = require('solr-client');
var SphinxClient = require('sphinxapi');
var sphinxLookup = require('./sphinx-lookup');
var google = Q.denodeify(require('google'));
var getDbFnames;

var readdir = Q.denodeify(fs.readdir);

var PUBLIC_LOGS_SITE = 'one-month-of-chat-logs.github.io';
var PERTINENT_KEYS = ['message', 'handle', 'sent'];
var RESULTS_PER_PAGE = 10;
var pertinentInfo = _.partialRight(_.pick, PERTINENT_KEYS);

function urlToISODate(url) {
  var split = url.split('/');
  var time = _.last(split).split('_');

  // timezones are for nerdz
  return moment()
    .year(+split[4])
    .month(+split[5] + 1)
    .day(+split[6])
    .hour(+time[0])
    .minute(+time[1])
    .second(+time[2]);
}

function urlToHandle(url) {
  return _.last(_.last(url.split('/')).split('.')[0].split('_'));
}

function processRawSolrResult(rawResult) {
  return rawResult.response.docs.map(pertinentInfo);
}

function processRawSphinxResult(rawResult) {
  var ids = _.pluck(rawResult.matches, 'id');
  return Q.all(ids.map(sphinxLookup))
    .then(function(results) {
      return results.map(pertinentInfo);
    });
}

function processRawGoogleResult(rawResult) {
  return rawResult[1].map(function(result) {
    return {
      sent: urlToISODate(result.href),
      handle: urlToHandle(result.href),
      message: result.title
    };
  });
}

module.exports.createServer = function createServer() {
  var solrClient = solr.createClient();
  var sphinxClient = new SphinxClient();

  sphinxClient.SetServer('localhost', 9312);
  sphinxClient.SetLimits(0, RESULTS_PER_PAGE);

  getDbFnames = readdir('sphinx/data')
    .then(function(files) {
      return files.filter(function(file) {
        return (/.json$/).test(file);
      });
    });

  return connect()
    .use(connect.logger('dev'))
    .use(connect.query())
    .use(function (req, res, next) {
      var q = (req.query.q || '')
        .replace('"', '\\"')
        .replace('\\', '\\\\');
      var solrQuery = solrClient.createQuery()
        .q('message:"' + q + '"')
        .rows(RESULTS_PER_PAGE)
        .start(0);

      res.setHeader('Content-Type', 'application/json');

      Q.all([
          Q.ninvoke(solrClient, 'search', solrQuery)
            .then(processRawSolrResult),
          Q.ninvoke(sphinxClient, 'Query', req.query.q)
            .then(processRawSphinxResult),
          google('site:' + PUBLIC_LOGS_SITE + ' ' + req.query.q)
            .then(processRawGoogleResult)
        ])
        .spread(function (solrResult, sphinxResult, googleResult) {
          res.end(JSON.stringify({
            solr: solrResult,
            sphinx: sphinxResult,
            google: googleResult
          }));
        })
        .fail(next);
    })
    .use(connect.errorHandler());
};
