var OPEN_CLOSE = /Log (opened|closed) (.*)/;
var MESSAGE = /^(\d+:\d+)\s+<[ ]?([^>]+)> (.*)/;
var HANDLE_CHANGE = /^(\d+:\d+)\s-\!-\s+([^\s]+)\s+(is )?now known as/;
var MODE_CHANGE = /^(\d+:\d+)\s-\!-\s+mode\//;
var DAY_CHANGE = /Day changed (.*)/;
var ME = /^(\d+:\d+)\s+\*\s+([^\s]+) (.*)/;
var TOPIC_CHANGE = /^(\d+:\d+)\s-\!-\s+\S+\s+changed the topic/;
var TOPIC = /^(\d+:\d+)\s-\!-\s+Topic/;
var USERS = /^(\d+:\d+)\s+\[/;
var IRSSI = /^(\d+:\d+)\s-\!-\s+Irssi:/;

function State(dateStr, options) {
  this.date(dateStr + ' 00:00:00');
  this._options = options;
}

State.prototype.date = function(dateStr) {
  this._date = new Date(dateStr);
};

State.prototype.time = function(timeStr) {
  var split = timeStr.split(':');
  var hours = +split[0];
  var minutes = +split[1];

  if (hours === this._date.getHours() && minutes === this._date.getMinutes()) {
    this._date.setSeconds(this._date.getSeconds() + 1);
  } else {
    this._date.setSeconds(0);
  }

  this._date.setHours(+split[0]);
  this._date.setMinutes(+split[1]);
};

State.prototype.handle = function(handle) {
  this._handle = handle;
};

State.prototype.dir = function() {
  return  this._options.docdir + '/' +
          this._date.getFullYear() + '/' +
          (this._date.getMonth() + 1) + '/' +
          this._date.getDate();
};

State.prototype.fname = function() {
  var d = this._date;
  return  this.dir() + '/' +
          d.getHours() + '_' +
          d.getMinutes() + '_' +
          d.getSeconds() + '_' +
          this._handle + '.txt';
};

module.exports = function() {
  var fs = require('fs');

  var options = this.options();

  fs.readdirSync(options.logdir).forEach(function(fname) {
    var state = new State(fname.split('.')[0], options);

    console.log('parsing', fname);
    var data = fs.readFileSync(options.logdir + '/' + fname);
    var parsed;

    data.toString().split('\n').forEach(function(line) {
      if ((parsed = line.match(OPEN_CLOSE))) {
        state.date(parsed[2]);
      } else if ((parsed = line.match(DAY_CHANGE))) {
        state.date(parsed[1]);
      } else if ((parsed = line.match(MESSAGE) || line.match(ME))) {
        state.time(parsed[1]);
        state.handle(parsed[2]);
        console.log(state.fname(), parsed[3]);
        // if (!shell.test('-e', state.fname())) {
        //   fs.writeFileSync(state.fname(), parsed[3]);
        // }
      } else if (line && !HANDLE_CHANGE.test(line) && !MODE_CHANGE.test(line) &&
          !TOPIC_CHANGE.test(line) && !TOPIC.test(line) && !USERS.test(line) &&
          !IRSSI.test(line)) {
        // throw new Error('PARSE ERROR: "' + line + '"');
        console.error('PARSE ERROR: "' + line + '"');
      }
    });
  });
};

module.exports.description = 'convert one log file into individual files';
