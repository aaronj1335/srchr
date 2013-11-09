module.exports = function() {
  var fs = require('fs');
  var client = require('solr-client').createClient();
  var parse = require('./../lib/parser');
  var Q = require('q');

  var readFile = Q.denodeify(fs.readFile);
  var readdir = Q.denodeify(fs.readdir);

  var options = this.options();
  var taskDone = this.async();

  function sequentiallyApply(fn, items) {
    return items.slice(1)
      .reduce(function(previous, fname) {
        return previous.then(function() {
          return fn(fname);
        });
      }, fn(items[0]));
  }

  function isLog(fname) {
    return !/^\./.test(fname);
  }

  function processFile(fname) {
    return readFile(options.logdir + '/' + fname)
      .then(function(data) {
        var docs = parse(fname, data);
        return Q.ninvoke(client, 'add', docs);
      });
  }

  readdir(options.logdir)
    .then(function(fnames) {
      return sequentiallyApply(processFile, fnames.filter(isLog));
    })
    .then(function() {
      return Q.ninvoke(client, 'commit');
    })
    .then(function() {
      taskDone();
    })
    .done();
};

module.exports.desc = 'parse log files and store them in the database';
