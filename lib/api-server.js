var _ = require('lodash');
var Q = require('q');
var moment = require('moment');
var connect = require('connect');
var ap = require('./ap');
var ndcg = require('./ndcg');
var solr = require('solr-client');
var SphinxClient = require('sphinxapi');
var sphinxLookup = require('./sphinx-lookup');
var google = require('./google');
var mongodb = require('mongodb').MongoClient;

var PUBLIC_LOGS_SITE = require('./config').PUBLIC_LOGS_SITE;
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
  return Q.ninvoke(mongodb, 'connect', 'mongodb://127.0.0.1:27017/irc-logs')
    .then(function(db) {
      var promise = Q.ninvoke(db, 'command', {text: 'messages', search: query});

      promise.then(function() {
        db.close();
      }, function() {
        db.close();
      });

      return promise;
    });
}

function urlToHandle(url) {
  return _.last(_.last(url.split('/')).split('.')[0].split('_'));
}

function addUrl(doc) {
  var date = new Date(doc.sent);
  return _.extend({
    url: '/docs/' +
      date.getFullYear() + '/' +
      (date.getMonth() + 1) + '/' +
      date.getDate() + '/' +
      date.getHours() + '_' +
      date.getMinutes() + '_' +
      date.getSeconds() + '_' +
      doc.handle + '.txt'
  }, doc);
}

function time(promise) {
  var start = new Date();
  return promise.then(function(result) {
    result.duration = new Date() - start;
    return result;
  });
}

module.exports.createServer = function createServer() {
  var solrClient = solr.createClient();
  var sphinxClient = new SphinxClient();
  var search = {
    solr: function(q) {
      var escapedQuery = (q || '')
        .replace('"', '\\"')
        .replace('\\', '\\\\');
      var solrQuery = solrClient.createQuery()
        .q('message:"' + escapedQuery + '"')
        .rows(RESULTS_PER_PAGE)
        .start(0);

      return Q.ninvoke(solrClient, 'search', solrQuery)
        .then(function(rawResult) {
          return rawResult.response.docs.map(pertinentInfo);
        });
    },

    sphinx: function(q) {
      return Q.ninvoke(sphinxClient, 'Query', q)
        .then(function(rawResult) {
          var ids = _.pluck(rawResult.matches, 'id');
          return Q.all(ids.map(sphinxLookup))
            .then(function(results) {
              return results.map(pertinentInfo);
            });
        });
    },

    mongo: function(q) {
      return mongoSearch(q)
        .then(function(rawResult) {
          return rawResult.results
            .slice(0, RESULTS_PER_PAGE)
            .map(function(item) {
              return pertinentInfo(item.obj);
            });
        });
    },

    google: function(q) {
      var googleQuery = 'site:' + PUBLIC_LOGS_SITE + ' ' + q;
      return google(googleQuery)
        .then(function(rawResult) {
          return rawResult.map(function(result) {
            return {
              sent: urlToISODate(result.href),
              handle: urlToHandle(result.href),
              message: result.title
            };
          });
        }, function() {
          console.error('GOOGLE FAILED', arguments);
          throw arguments[0];
        });
    }
  };

  sphinxClient.SetServer('localhost', 9312);
  sphinxClient.SetLimits(0, RESULTS_PER_PAGE);

  return connect()
    .use(connect.logger('dev'))
    .use(connect.query())
    .use(function (req, res, next) {
      res.setHeader('Content-Type', 'application/json');

      var promises = _.map(search, function(searchFn, engine) {
        var promise = searchFn(req.query.q)
          .then(function(docs) {
            return {
              engine: engine,
              docs: docs.map(addUrl)
            };
          });

        return time(promise);
      });

      Q.all(promises)
        .then(function (results) {
          var googleResults = _.where(results, {engine: 'google'})[0];
          var relevantDocs = _.pluck(googleResults.docs, 'url');

          results
            .filter(function(result) {
              return result.engine !== 'google';
            })
            .forEach(function(result) {
              var docs = _.pluck(result.docs, 'url');
              result.ap = ap(relevantDocs, docs);
              result.ndcg = ndcg(relevantDocs, docs);
            });

          googleResults.docs = googleResults.docs.slice(0, RESULTS_PER_PAGE);

          res.end(JSON.stringify(results));
        })
        .fail(next);
    })
    .use(connect.errorHandler());
};
