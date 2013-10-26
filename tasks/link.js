module.exports = function() {
  var fs = require('fs');
  var exists = fs.existsSync;
  var child = require('child_process');
  var done = this.async();
  var executable;
  var home = process.env.HOME;
  var libs = {'/usr/local/bin/solr': '/usr/local/Cellar/solr/4.5.0/libexec'};
  libs[home + '/code/solr-4.5.1/bin/solr'] = home + '/code/solr-4.5.1';

  if (exists('solr/lib'))
    return done();

  console.log('creating link');

  child.exec('which solr', function(err, stdout) {
    var lib = libs[stdout.replace(/\n$/, '')];
    fs.symlinkSync(lib, 'solr/lib');
    done();
  });
};

module.exports.desc = 'make a link to the solr libraries';
