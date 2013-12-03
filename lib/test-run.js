/**
 * calculate map and mean ndcg@10 for the search engines
 *
 * use queries in `etc/searches.txt`
 *
 * this code is SUUUUUUPER gross
 *
 * @returns {Object} with `totals` and `ranking` properties
 */
var qs = require('querystring');
var fs = require('fs');
var _ = require('lodash');
var Q = require('q');
var request = Q.denodeify(require('request'));
var readFile = Q.denodeify(fs.readFile);
var avg = require('./math/avg');

function notGoogle(result) {
  return result.engine !== 'google';
}

function getRanking(totals, prop) {
  var mprop = 'm' + prop;

  return _.chain(totals)
    .map(function(total, engine) {
      var ret = {engine: engine};
      ret[mprop] = avg(total[prop]);
      return ret;
    })
    .sortBy(mprop)
    .value()
    .reverse();
}

module.exports = function() {
  return readFile('etc/searches.txt')

    // run all of the searches in series
    .then(function(searches) {
      return searches
        .toString()
        .replace(/\s+$/, '')
        .replace(/^\s+/, '')
        .split('\n')
        .map(function(term) {
          return function(previousResult) {
            var url = 'http://localhost:2999?q=' + qs.escape(term);

            console.log('requesting:',url);

            return request(url)
              .spread(function(response, body) {
                var result = JSON.parse(body);

                result.term = term;

                return previousResult.concat([result]);
              });
          };
        })
        .reduce(Q.when, Q([]));
    })

    // crunch the numbers
    .then(function(runs) {
      var totals = runs.reduce(function(totals, run) {
        run.filter(notGoogle)
          .forEach(function(result) {
            var engineTotals =
              totals[result.engine] = totals[result.engine] || {};

            (engineTotals.ap = engineTotals.ap || []).push(result.ap);
            (engineTotals.rap = engineTotals.rap || []).push(result.rap);
            (engineTotals.ndcg = engineTotals.ndcg || []).push(result.ndcg);
          });
        return totals;
      }, {});

      var ranking = {
        map: getRanking(totals, 'ap'),
        mrap: getRanking(totals, 'rap'),
        mndcg: getRanking(totals, 'ndcg'),
      };

      return {
        totals: totals,
        ranking: ranking
      };
    });
};
