var fs = require('fs');
var _ = require('lodash');
var Q = require('q');
var connect = require('connect');
var solr = require('solr-client');
var SphinxClient = require('sphinxapi');
var sphinxLookup = require('./sphinx-lookup');
var getDbFnames;

var readdir = Q.denodeify(fs.readdir);

var PERTINENT_KEYS = ['message', 'handle', 'sent'];
var pertinentInfo = _.partialRight(_.pick, PERTINENT_KEYS);

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

module.exports.createServer = function createServer() {
  var solrClient = solr.createClient();
  var sphinxClient = new SphinxClient();

  sphinxClient.SetServer('localhost', 9312);

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
        .rows(10)
        .start(0);

      res.setHeader('Content-Type', 'application/json');

      Q.all([
          Q.ninvoke(solrClient, 'search', solrQuery)
            .then(processRawSolrResult),
          Q.ninvoke(sphinxClient, 'Query', req.query.q)
            .then(processRawSphinxResult)
        ])
        .spread(function (solrResult, sphinxResult) {
          res.end(JSON.stringify({
            solr: solrResult,
            sphinx: sphinxResult
          }));
        })
        .fail(next);
    })
    .use(connect.errorHandler());
};
