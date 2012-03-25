var spawn = require('child_process').spawn;

child = spawn('ssh', ['-i/Users/davemckenna/.ec2/ec21.pem', '-lubuntu', 'ec2-107-22-129-145.compute-1.amazonaws.com', 'date']);
//child = spawn('scp', ['-i/Users/davemckenna/.ec2/ec21.pem', '/Users/davemckenna/npm-debug.log', 'ubuntu@ec2-107-22-129-145.compute-1.amazonaws.com:~']);

child.stdout.addListener('data', function (data) {
  console.log('called stdout');
  console.log('stdout: ', data.toString());
});

child.stderr.addListener('data', function (data) {
  console.log('called stderr');
  console.log('stderr: ', data.toString());
});

child.addListener('exit', function (code) {
  console.log('exit: ', code);
  if (code === 0) {
    //Figure out my own way to chain commands
  } else {
  }
});


/*
var util = require('util'),
    settings = require('../settings.js');

var ssh = require('control');

var sshConfig = Object.create(ssh.controller);
sshConfig.user = settings.ec2InstanceUser;
sshConfig.sshOptions = [];
sshConfig.sshOptions.push('-i' + settings.sshKeyfileLoc);
sshConfig.scpOptions = sshConfig.sshOptions;

domains=['ec2-107-22-129-145.compute-1.amazonaws.com',
         'ec2-23-20-170-212.compute-1.amazonaws.com']

var sshJobs = ssh.controllers(domains, sshConfig);
var sshJob;

for (var i = 0, l = sshJobs.length; i < l; i += 1) {
  sshJob = sshJobs[i];
  sshJob.scp('/Users/davemckenna/npm-debug.log', '~', function(){
    sshJob.ssh('sudo mv npm-debug.log fartface');
  });
}
*/
