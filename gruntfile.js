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
      sphinx: {src: ['sphinx/data/.s*', 'sphinx/data/db*']}
    },

    shell: {
      // we have to sleep because who friggin knows how long it'll take to
      // start the jvm, but it's necessary to wait for the index task
      solrd: {
        options: {stdout: true},
        command: '( nohup solr ' + process.env.PWD + '/solr > solr/var/log/output.log 2>&1 & ) && sleep 5'
      },
      'solrd-stop': {
        options: {stdout: true},
        command: 'kill $(ps aux | grep solr | grep `pwd`/solr | grep -v grep | awk \'{print $2}\' | sort -r | head -1)'
      },
      'sphinx-index': {
        options: {stdout: true},
        command: 'indexer --config sphinx/etc/sphinx.conf --all'
      },
      sphinxd: {
        options: {stdout: true},
        command: 'searchd --config sphinx/etc/sphinx.conf'
      },
      'sphinxd-stop': {
        options: {stdout: true},
        command: 'searchd --config sphinx/etc/sphinx.conf --stop'
      }
    },

    concurrent: {
      clean: ['clean:solr', 'clean:sphinx'],
      index: ['solr-index', 'sphinx-index']
    }
  };

  grunt.initConfig(config);

  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-concurrent');

  grunt.registerTask('dev-server', function() {
    var done = this.async();

    process.on('SIGINT', function() {
      grunt.task.run('solrd-stop');
      grunt.task.run('sphinxd-stop');
      done();
    });

    process.on('SIGQUIT', function() {
      done();
    });

    require('./lib/api-server').createServer().listen(2999);
    require('./lib/app-server').createServer().listen(3000);
    grunt.log.writeln('api server listening on 2999, app server on 3000');
  });

  grunt.registerTask('sphinx-index', ['shell:sphinx-index']);
  grunt.registerTask('index', [
    'download-logs',
    'solrd-stop',
    'concurrent:clean',
    'solrd',
    'concurrent:index',
    'solrd-stop'
  ]);
  grunt.registerTask('solrd', ['link', 'shell:solrd']);
  grunt.registerTask('solrd-stop', ['shell:solrd-stop']);
  grunt.registerTask('sphinxd', ['shell:sphinxd']);
  grunt.registerTask('sphinxd-stop', ['shell:sphinxd-stop']);
  grunt.registerTask('stop', ['shell:solrd-stop', 'shell:sphinxd-stop']);
  grunt.registerTask('dev', [
    'solrd-stop',
    'sphinxd-stop',
    'solrd',
    'sphinxd',
    'dev-server'
  ]);

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

