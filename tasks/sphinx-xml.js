module.exports = function() {
  var _ = require('lodash');
  var fs = require('fs');
  var Q = require('q');
  var parse = require('./../lib/parser');
  var readFile = Q.denodeify(fs.readFile);
  var readdir = Q.denodeify(fs.readdir);
  var start = fs.readFileSync('sphinx/etc/templates/start.xml');
  var docsTemplateText = fs.readFileSync('sphinx/etc/templates/docs.tmpl');
  var docsTemplate = _.template(docsTemplateText.toString());
  var end = fs.readFileSync('sphinx/etc/templates/end.xml');

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

  String.prototype/* ☠ ☠ ☠ FOR SHAME ☠ ☠ ☠ */.escape = function() {
    return this.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;');
  };

  function processFile(fname) {
    return readFile(options.logdir + '/' + fname)
      .then(function(data) {
        var docs = parse(fname, data)
          .map(function(doc) {
            doc.id = _.uniqueId();
            return doc;
          });
        var docsXml = docsTemplate({docs: docs});
        return Q.ninvoke(process.stderr, 'write', docsXml);
      });
  }

  Q.all([
      readdir(options.logdir),
      Q.ninvoke(process.stderr, 'write', start)
    ])
    .then(function(fnames) {
      return sequentiallyApply(processFile, fnames[0].filter(isLog));
    })
    .then(function() {
      return Q.invoke(process.stderr, 'write', end);
    })
    .then(function() {
      taskDone();
    })
    .done();
};
