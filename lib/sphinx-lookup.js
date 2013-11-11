/*
 * @module lib/sphinx-lookup
 *
 * sphinx only returns document id's, so we need to store the actual documents
 * separately. unfortunately we can't just look at the original logs, since the
 * numbers need to be integer id's.
 *
 * when we load the log files into sphinx, we also makes a file like
 * `sphinx/data/db1.json`, where the `1` is the id if the first document in
 * that file. the contents look something like this:
 *
 *     [
 *       {
 *         "message": "SubStack: hi",
 *         "handle": "circlicious",
 *         "sent": "2012-06-16T20:00:00.000Z",
 *         "id": "1"
 *       },
 *       {
 *         "message": "beep boop",
 *         "handle": "SubStack",
 *         "sent": "2012-06-16T20:00:01.000Z",
 *         "id": "2"
 *       },
 *       {
 *         "message": "boop beep",
 *         "handle": "tuhoojabotti",
 *         "sent": "2012-06-16T20:01:00.000Z",
 *         "id": "3"
 *       },
 *       ...
 *
 * this module caches all of the file reads into the `dbFileCache` object,
 * whose structure ends up being something like:
 *
 *     {
 *       'db1.json': {
 *         '1': {
 *           message: 'SubStack: hi',
 *           handle: 'circlicious',
 *           sent: '2012-06-16T20:00:00.000Z',
 *           id: '1'
 *          },
 *          {
 *            message: 'beep boop',
 *            handle: 'SubStack',
 *            sent: '2012-06-16T20:00:01.000Z',
 *            id: '2'
 *          },
 *          ...
 *       },
 *       ...
 */
var fs = require('fs');
var _ = require('lodash');
var Q = require('q');
var readdir = Q.denodeify(fs.readdir);
var readFile = Q.denodeify(fs.readFile);
var getDbFnames;
var dbFileCache = {};
var SPHINX_DATA = 'sphinx/data';

/**
 * return the starting number id for the given file
 *
 * @example
 * // returns 2345
 * startingId('db2345.json')
 *
 * @param {String} fname - the db json file, i.e. `db2345.json`
 * @returns {Number} the starting id
 */
function startingId(fname) {
  return +fname.replace(/^db/, '').split('.')[0];
}

/**
 * read a `dbX.json` file, format it's contents into a lookup object, and store
 * that in the `dbFileCache`
 *
 * @param {String} fname - name of the file, like `db1.json`
 * @returns {Promise} promise of the object stored in dbFileCache
 */
function lookupFileCache(fname) {
  if (!dbFileCache[fname]) {
    dbFileCache[fname] = readFile(SPHINX_DATA + '/' + fname)
      .then(function(data) {
        return JSON.parse(data.toString())
          .reduce(function(cache, item) {
            cache[item.id] = item;
            return cache;
          }, {});
      });
  }

  return dbFileCache[fname];
}

/**
 * get the list of `dbX.json` files from `sphinx/data`.
 *
 * the lookup is only made once and cached for the life of the process.
 *
 * @returns {Promise} promise of the list of names
 */
function dbFnames() {
  if (!getDbFnames) {
    getDbFnames = readdir(SPHINX_DATA)
      .then(function(files) {
        return files.filter(function(file) {
            return (/.json$/).test(file);
          })
          .sort(function(a, b) {
            a = startingId(a);
            b = startingId(b);

            return a > b? -1:
                   a < b?  1:
                           0;
          });
      });
  }

  return getDbFnames;
}

/**
 * lookup the item from the given id
 *
 * the lookups are cached for the life of the process. the cache is never
 * purged.
 *
 * @param id - id of the document to lookup
 * @returns {Promise} promise of something like `{message: ..., handle: ...}`
 */
module.exports = function sphinxLookup(id) {
  var fname;

  return dbFnames()
    .then(function(fnames) {
      fname = _.find(fnames, function(fname) {
        return startingId(fname) <= +id;
      });

      if (!fname) {
        throw new Error(id + ' not found in ' + fnames.toString());
      }

      return lookupFileCache(fname);
    })
    .then(function(fileCache) {
      if (!fileCache[id]) {
        throw new Error(id + ' not found in ' + fname);
      }

      return fileCache[id];
    });
};

