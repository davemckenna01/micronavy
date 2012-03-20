var util = require('util'),
    settings = require('./settings.js');

var control = require('control'),
    shared = Object.create(control.controller),
    i, l, controller, controllers;



shared.user = settings.ec2InstanceUser;
shared.sshOptions = [];
shared.sshOptions.push('-i' + settings.sshKeyfileLoc);

domains=['ec2-72-44-36-170.compute-1.amazonaws.com',
         'ec2-184-73-101-252.compute-1.amazonaws.com']


controllers = control.controllers(domains, shared);

for (i = 0, l = controllers.length; i < l; i += 1) {
  controller = controllers[i];
  controller.ssh('date');
}
