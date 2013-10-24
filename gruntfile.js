module.exports = function(grunt) {
  var _ = grunt.util._;
  var fs = require('fs');

  var globalOptions = {
    urls: 'etc/urls.json',
    logdir: 'logs',
    docdir: 'docs',
    sitemapdir: 'sitemaps',
    template: 'etc/index.tmpl',
    sitemap: 'etc/sitemap.tmpl',
    sitemapindex: 'etc/sitemapindex.tmpl'
  };

  var config = {};

  var tasks = fs.readdirSync('tasks')
    .filter(/.js$/.test.bind(/.js$/))
    .map(function(taskFile) {
      var name = taskFile.split('.')[0];
      var module = require('./tasks/' + name);

      config[name] = _.extend({}, {options: globalOptions});

      return {name: name, module: module, desc: module.desc};
    });

  grunt.initConfig(config);

  tasks.forEach(function(task) {
    var args = [task.name, task.desc]
      .concat(task.deps || [])
      .concat([task]);
    grunt.registerTask.apply(grunt, args);
  });
};
