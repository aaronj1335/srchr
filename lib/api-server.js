var _ = require('lodash');
var Q = require('q');
var moment = require('moment');
var connect = require('connect');
var solr = require('solr-client');
var SphinxClient = require('sphinxapi');
var sphinxLookup = require('./sphinx-lookup');
var google = require('./google');
var mongodb = require('mongodb').MongoClient;
var mongoClient;

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
    .month(+split[5] - 1)
    .date(+split[6])
    .hour(+time[0])
    .minute(+time[1])
    .second(+time[2]);
}

function mongoSearch(query) {
  var connect = mongoClient?
    Q(mongoClient) :
    Q.ninvoke(mongodb, 'connect', 'mongodb://127.0.0.1:27017/irc-logs');

  return connect
    .then(function(db) {
      return Q.ninvoke(db, 'command', {text: 'messages', search: query});
    });
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

function processRawMongoResult(rawResult) {
  return rawResult.results
    .slice(0, RESULTS_PER_PAGE)
    .map(function(item) {
      return pertinentInfo(item.obj);
    });
}

function processRawGoogleResult(rawResult) {
  return rawResult.map(function(result) {
    return {
      sent: urlToISODate(result.href),
      handle: urlToHandle(result.href),
      message: result.title
    };
  });
}

function addUrls(result) {
  result.forEach(function(item) {
    var date = new Date(item.sent);
    item.url = '/docs/' +
      date.getFullYear() + '/' +
      (date.getMonth() + 1) + '/' +
      date.getDate() + '/' +
      date.getHours() + '_' +
      date.getMinutes() + '_' +
      date.getSeconds() + '_' +
      item.handle + '.txt';
  });
}

module.exports.createServer = function createServer() {
  var solrClient = solr.createClient();
  var sphinxClient = new SphinxClient();

  sphinxClient.SetServer('localhost', 9312);
  sphinxClient.SetLimits(0, RESULTS_PER_PAGE);

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
      var googleQuery = 'site:' + PUBLIC_LOGS_SITE + ' ' + req.query.q;

      res.setHeader('Content-Type', 'application/json');

      Q.all([
          Q.ninvoke(solrClient, 'search', solrQuery)
            .then(processRawSolrResult),
          Q.ninvoke(sphinxClient, 'Query', req.query.q)
            .then(processRawSphinxResult),
          mongoSearch(req.query.q)
            .then(processRawMongoResult),
          google(googleQuery, {limit: RESULTS_PER_PAGE})
            .then(processRawGoogleResult)
        ])
        .spread(function (solrResult, sphinxResult, mongoResult, googleResult) {
          var results = {
            solr: solrResult,
            sphinx: sphinxResult,
            mongo: mongoResult,
            google: googleResult
          };

          _.each(results, addUrls);

          res.end(JSON.stringify(results));
        })
        .fail(next);
    })
    .use(connect.errorHandler());
};
