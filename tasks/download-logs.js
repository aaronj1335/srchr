module.exports = function() {
  var _ = require('lodash');
  var request = require('request');
  var options = this.options();
  var urls = require('./../' + options.urls);
  var taskFinished = this.async();
  var fs = require('fs');
  var async = require('async');

  function fname(url) {
    return options.logdir + '/' + _.last(url.split('/'));
  }

  // we want to download the logs 20 at a time since the network is probably
  // the bottleneck
  var q = async.queue(function(url, done) {
    request(url, function(err, response) {
      if (err) {
        console.error('ERROR: could not get ' + url, err);
        done(false);
      }

      fs.writeFile(fname(url), response.body, function(err) {
        if (err) {
          console.error('ERROR: could not write file "' + fname(url) + '"');
          done(err);
        }

        done();
      });
    });
  }, 20);

  if (!fs.existsSync(options.logdir)) {
    fs.mkdirSync(options.logdir);
  }

  // here is where we limit things to the first month(ish) of chat logs
  urls.slice(0, 32).forEach(function(url) {
    if (!fs.existsSync(fname(url))) {
      console.log('fetching', url);
      q.push(url);
    } else {
      console.log('skipping "' + url + '"');
    }
  });

  if (q.length()) {
    q.drain = taskFinished;
  } else {
    taskFinished();
  }
};

module.exports.desc = 'download the daily logs from @isaacs site';

