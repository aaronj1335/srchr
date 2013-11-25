function trim(s) {
  return s.replace(/\s+$/, '').replace(/^\s+/, '');
}

function notGoogle(result) {
  return result.engine !== 'google';
}

function avg(array) {
  return array.reduce(function(sum, x) {
    return sum + x;
  }, 0) / array.length;
}

module.exports = function() {
  var fs = require('fs');
  var qs = require('querystring');
  var _ = require('lodash');
  var Q = require('q');
  var request = Q.denodeify(require('request'));
  var readFile = Q.denodeify(fs.readFile);
  var taskDone = this.async();

  readFile('etc/searches.txt')
    .then(function(searches) {
      return trim(searches.toString())
        .split('\n')
        .map(function(term) {
          return function(previousResult) {
            var url = 'http://localhost:2999?q=' + qs.escape(term);
            console.log('requesting:',url);
            return request(url)
              .spread(function(response, body) {
                // console.log(body);
                var result = JSON.parse(body);
                result.term = term;
                // console.log(previousResult);
                return previousResult?
                  previousResult.concat([result]) : [result];
              });
          };
        })
        .reduce(Q.when, Q());
    })
    .then(function(runs) {
      var totals = runs.reduce(function(totals, run) {
        run.filter(notGoogle)
          .forEach(function(result) {
            var engineTotals =
              totals[result.engine] = totals[result.engine] || {};
            (engineTotals.ap = engineTotals.ap || []).push(result.ap);
            (engineTotals.ndcg = engineTotals.ndcg || []).push(result.ndcg);
          });
        return totals;
      }, {});

      var ranking = {
        map: _.sortBy(_.map(totals, function(total, engine) {
            return {engine: engine, map: avg(total.ap)};
          }), 'map').reverse(),
        mndcg: _.sortBy(_.map(totals, function(total, engine) {
            return {engine: engine, mndcg: avg(total.ndcg)};
          }), 'mndcg').reverse()
      };

      console.log(JSON.stringify(totals, null, '  '));
      console.log(JSON.stringify(ranking, null, '  '));
      taskDone();
    })
    .done();
};
