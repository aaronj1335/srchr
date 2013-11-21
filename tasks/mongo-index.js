module.exports = function() {
  var fs = require('fs');
  var parse = require('./../lib/parser');
  var MongoClient = require('mongodb').MongoClient;
  var Q = require('q');

  var readFile = Q.denodeify(fs.readFile);
  var readdir = Q.denodeify(fs.readdir);

  var options = this.options();
  var taskDone = this.async();

  var connect =
    Q.ninvoke(MongoClient, 'connect', 'mongodb://127.0.0.1:27017/irc-logs');
  var getLogs = readdir(options.logdir);
  var collection;
  var fnames;

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
        return Q.ninvoke(collection, 'insert', docs, {safe: true});
      });
  }

  Q.all([connect, getLogs])
    .spread(function(db, logFnames) {
      collection = db.collection('messages');
      fnames = logFnames;
      return Q.ninvoke(collection, 'ensureIndex', {
        message: 'text',
        handle: 'text'
      });
    })
    .then(function() {
      return sequentiallyApply(processFile, fnames.filter(isLog));
    })
    .then(function() {
      taskDone();
    })
    .done();
};

module.exports.desc = 'parse log files and store them in the database';

