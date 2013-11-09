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
      solr: {src: ['solr/collection1/data/*']},
      sphinx: {src: ['sphinx/data/.s*']}
    },

    shell: {
      solr: {
        options: {stdout: true},
        command: 'solr ' + process.env.PWD + '/solr'
      },
      'sphinx-index': {
        options: {stdout: true},
        command: 'indexer --config sphinx/etc/sphinx.conf --all'
      },
      'sphinxd': {
        options: {stdout: true},
        command: 'searchd --config sphinx/etc/sphinx.conf'
      },
      'sphinxd-stop': {
        options: {stdout: true},
        command: 'searchd --config sphinx/etc/sphinx.conf --stop'
      }
    }
  };

  grunt.initConfig(config);

  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-contrib-clean');

  grunt.registerTask('sphinx-index', ['shell:sphinx-index']);
  grunt.registerTask('index', ['sphinx-index', 'solr-index']);
  grunt.registerTask('solrd', ['link', 'shell:solr']);
  grunt.registerTask('sphinxd', ['shell:sphinxd']);
  grunt.registerTask('sphinxd-stop', ['shell:sphinxd-stop']);

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

