/**
 * search google results by scraping their webpage
 *
 * inspired by @jprichardson's 'google' npm package:
 *
 *  https://github.com/jprichardson/node-google
 *
 * but extended since i need multiple pieces of code to be able to use it in
 * the same process.
 */
var qs = require('querystring');
var util = require('util');
var _ = require('lodash');
var Q = require('q');
var request = require('request');
var cheerio = require('cheerio');

var linkSel = 'h3.r a';
var descSel = 'div.s';
var itemSel = 'li.g';
var nextSel = 'td.b a span';

var URL = 'http://www.google.com/search?hl=en&q=%s&start=%s&sa=N&num=%s&ie=UTF-8&oe=UTF-8';

// spoof the IE7 user agent in hopes of not getting rate-limited. using the IE7
// format makes it much easier to parse the html than, for instance, chrome's UA
var headers = {
  'user-agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)'
};

// track cookies. also in hopes of not triggering google's rate limiting.
var jar = request.jar();

// use this to throttle requests to 1 per second
var queue = Q();

queue.q = 'initial';

function timeout(ms) {
  return function () {
    var deferred = Q.defer();

    setTimeout(function() {
      deferred.resolve();
    }, ms);

    return deferred.promise;
  };
}

function google(q, opts) {
  var cfg = _.extend({
    page: 0,
    limit: null,
    perPage: 100,
    cap: 1000
  }, opts);
  var results = [];
  var deferred = Q.defer();

  if (cfg.limit == null)
    cfg.limit = cfg.cap;

  if (cfg.limit < cfg.perPage)
    cfg.perPage = cfg.limit;

  function execute(cfg) {
    var params = {
      url: util.format(URL, qs.escape(q), cfg.page, cfg.perPage),
      headers: headers,
      jar: jar
    };

    request(params, function(err, resp, body) {
      if (err) {
        deferred.reject([err, resp, body]);
      } else if (resp.statusCode >= 300) {
        deferred.reject([err, resp, body]);
      } else {
        var $ = cheerio.load(body);

        $(itemSel).each(function(i, elem) {
          var linkElem = $(elem).find(linkSel);
          var descElem = $(elem).find(descSel);
          var item = {title: $(linkElem).text()};
          var qsObj = qs.parse($(linkElem).attr('href'));

          if (qsObj['/url?q']) {
            item.link = qsObj['/url?q'];
            item.href = item.link;
          }

          $(descElem).find('div').remove();
          item.description = $(descElem).text();

          if (results.length < cfg.limit)
            results.push(item);
        });

        if (results.length > cfg.cap) {
          deferred.reject(['ERROR: too many results', results]);
        } else if (results.length < cfg.limit &&
            $(nextSel).last().text() === 'Next') {
          cfg.page++;
          execute(cfg);
        } else {
          deferred.resolve(results);
        }
      }
    });
  }

  queue.then(timeout(1000))
    .then(function() {
      execute(cfg);
    });

  queue = deferred.promise;
  queue.q = q;

  return deferred.promise;
}

module.exports = google;

