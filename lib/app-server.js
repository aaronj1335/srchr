var url = require('url').parse('http://localhost:2999');
var connect = require('connect');
var proxy = require('proxy-middleware');

module.exports.createServer = function createServer() {
  return connect()
    .use(connect.logger('dev'))
    .use('/api', proxy(url))
    .use(connect.staticCache())
    .use(connect.static('public'));
};
