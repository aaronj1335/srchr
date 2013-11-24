var _ = require('lodash');

/**
 * calculate the average precision
 *
 * @param relevantDocs {List(String)} url's of all relevant docs
 * @param results {List(String)} url's returned by the search
 * @returns {Number} AP
 */
module.exports = function(relevantDocs, results) {
  function rel(i) {
    return relevantDocs.indexOf(results[i]) >= 0? 1 : 0;
  }

  function p(k) {
    return _.intersection(relevantDocs, results.slice(0, k)).length / k;
  }

  var sum = results.reduce(function(sum, result, i) {
    return sum + p(i + 1) * rel(i);
  }, 0);

  return sum / relevantDocs.length;
};
