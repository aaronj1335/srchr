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
    var cursorUrl = util.format(URL, qs.escape(q), cfg.page, cfg.perPage);

    request(cursorUrl, function(err, resp, body) {
      if (err) {
        deferred.reject(err);
      } else if (resp.statusCode >= 300) {
        deferred.reject(resp);
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
          deferred.reject(results);
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

  execute(cfg);

  return deferred.promise;
}

module.exports = google;

