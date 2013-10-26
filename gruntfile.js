module.exports = function(grunt) {
  var _ = grunt.util._;
  var fs = require('fs');

  var globalOptions = {
    urls: 'etc/urls.json',
    logdir: 'logs',
    docdir: 'docs',
  };

  var config = {
    clean: {
      data: {src: ['solr/collection1/data/*']}
    },

    shell: {
      solr: {
        options: {stdout: true},
        command: 'solr ' + process.env.PWD + '/solr'
      }
    }
  };

  grunt.initConfig(config);

  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-contrib-clean');

  grunt.registerTask('dev', ['shell:solr']);

  // load tasks in 'tasks' directory
  fs.readdirSync('tasks')
    .filter(RegExp.prototype.test.bind(/.js$/))
    .map(function(taskFile) {
      var name = taskFile.split('.')[0];
      var module = require('./tasks/' + name);

      config[name] = _.extend({}, {options: globalOptions});
      grunt.registerTask(name, module.desc, module);
    });
};

