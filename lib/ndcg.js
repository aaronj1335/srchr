/**
 * calculate normalized discounted cumulative gain (nDCG)
 *
 * the depth of the calculation is determined by the length of results, so if
 * `results.length == 10`, then this returns nDCG@10
 *
 * @param relevantDocs {List(String)} url's of all relevant docs
 * @param results {List(String)} url's returned by the search
 * @returns {Number} nDCG
 */
module.exports = function(relevantDocs, results) {
  /**
   * relevance of doc at rank i
   */
  function rel(i) {
    return relevantDocs.indexOf(results[i]) >= 0? 1 : 0;
  }

  function log2(x) {
    return Math.log(x) / Math.log(2);
  }

  function dcg() {
    return results.reduce(function(sum, result, i) {
      return i === 0? rel(1) : sum + rel(i + 1) / log2(i + 1);
    }, 0);
  }

  function idcg() {
    return results.reduce(function(sum, result, i) {
      return i === 0? 1 : sum + 1 / log2(i + 1);
    }, 0);
  }

  return dcg() / idcg();
};
