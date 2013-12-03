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
var fs = require('fs');
var qs = require('querystring');
var util = require('util');
var _ = require('lodash');
var Q = require('q');
var requestModule = require('request');
var request = Q.denodeify(requestModule);
var cheerio = require('cheerio');
var readFile = Q.denodeify(fs.readFile);
var writeFile = Q.denodeify(fs.writeFile);

var LINK_SEL = 'h3.r a';
var DESC_SEL = 'div.s';
var ITEM_SEL = 'li.g';
var NEXT_SEL = 'td.b a span';

var URL = 'http://www.google.com/search?hl=en&q=%s&start=%s&sa=N&num=%s&ie=UTF-8&oe=UTF-8';

// spoof the IE7 user agent in hopes of not getting rate-limited. using the IE7
// format makes it much easier to parse the html than, for instance, chrome's UA
var headers = {
  'user-agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)'
};

// track cookies. also in hopes of not triggering google's rate limiting.
var jar = requestModule.jar();

// use this to throttle requests to 1 per second
var queue = Q();

function timeout(ms) {
  return function () {
    var deferred = Q.defer();

    setTimeout(function() {
      deferred.resolve();
    }, ms);

    return deferred.promise;
  };
}

/**
 * throttled, promise-returning version of @mikeal's `request`
 *
 * only works for GET requests, assumes arg is a params object
 *
 * @param params {Object} - params object, similar to what you'd pass into
 *  `request`. the `url` property is assumed to be there
 *
 * @returns a promise of response and body, similar to a `Q.denodeify`ed
 *  version of `request`
 */
function throttledRequest(params) {
  var promise = queue.then(function() {
    return request(params);
  });

  queue = promise.then(timeout(1000));

  return promise;
}

/**
 * cached, throttled, promise-returning version of @mikeal's `request`
 *
 * only works for GET requests, assumes arg is a params object
 *
 * @param params {Object} - params object, similar to what you'd pass into
 *  `request`. the `url` property is assumed to be there
 *
 * @returns a promise of response and body, similar to a `Q.denodeify`ed
 *  version of `request`
 */
function cachedThrottledRequest(params) {
  var cacheFname =
    'google/var/' + params.url.replace(/^http:\/\/www.google.com\//, '');

  return readFile(cacheFname)
    .then(function(data) {
      return [{statusCode: 0}, data];
    })
    .fail(function(e) {
      if (e.code === 'ENOENT') {
        return throttledRequest(params)
          .spread(function(resp, body) {
            writeFile(cacheFname, body)
              .fail(function(e) {
                console.error('COULD NOT WRITE GOOGLE CACHE FILE:',e);
              });
            return [resp, body];
          });
      }

      throw e;
    });
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

    cachedThrottledRequest(params)
      .spread(function(resp, body) {
        if (resp.statusCode >= 300) {
          deferred.reject(resp);
        } else {
          var $ = cheerio.load(body);

          $(ITEM_SEL).each(function(i, elem) {
            var linkElem = $(elem).find(LINK_SEL);
            var descElem = $(elem).find(DESC_SEL);
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
              $(NEXT_SEL).last().text() === 'Next') {
            cfg.page++;
            execute(cfg);
          } else {
            deferred.resolve(results);
          }
        }
      })
      .fail(function(err) {
        deferred.reject(err);
      });
  }

  execute(cfg);

  return deferred.promise;
}

module.exports = google;

