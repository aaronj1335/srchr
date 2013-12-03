/**
 * test run client
 *
 * grunt task for querying everthing in `etc/searches.txt` and calculating
 * performance results.
 *
 * assumes that the other servers are already running.
 */

module.exports = function() {
  var testRun = require('./../lib/test-run');
  var taskDone = this.async();

  testRun()
    .then(function(result) {
      console.error(JSON.stringify(result.ranking, null, '  '));
      taskDone();
    })
    .done();
};
