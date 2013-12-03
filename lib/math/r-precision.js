var ap = require('./ap');

/**
 * calculate the average r-precision
 *
 * this just truncates the 'results' to the length of relevant docs, so the
 * caller doesn't need to worry about the length of the returned results.
 *
 * @param relevantDocs {List(String)} url's of all relevant docs
 * @param results {List(String)} url's returned by the search
 * @returns {Number} AP
 */
module.exports = function(relevantDocs, results) {
  return ap(relevantDocs, results.slice(0, relevantDocs.length));
};
