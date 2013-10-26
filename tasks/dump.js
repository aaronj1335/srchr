module.exports = function() {
  var Q = require('Q');
  var client = require('solr-client').createClient();
  var taskDone = this.async();
  var rowsQuery = client.createQuery()
    .q('*:*')
    .rows(0);
  var queried = 0;
  var step = 10;
  var total;

  function done() {
    write(']\n').
      then(function() {
        taskDone();
      });
  }

  function err() {
    console.log(arguments);
    taskDone(false);
  }

  // grunt is worthless, so it just craps all over stdout, so log to stderr
  // instead
  function write(chunk) {
    return Q.ninvoke(process.stderr, 'write', chunk, 'utf8');
  }

  function printChunk() {
    var query = client.createQuery()
      .q('*:*')
      .rows(step)
      .start(queried);

    queried += step;

    Q.ninvoke(client, 'search', query)
      .then(function(result) {
        var str = result.response.docs
          .map(JSON.stringify)
          .join(',\n');

        str += queried < total? ',\n' : '';

        return write(str);
      })
      .then(queried < total? printChunk : done)
      .fail(err);
  }

  Q.ninvoke(client, 'search', rowsQuery)
    .then(function(obj) {
      total = obj.response.numFound;
      return write('[');
    })
    .then(printChunk)
    .fail(err);
};

module.exports.desc = 'stream of all of the documents to stderr';
