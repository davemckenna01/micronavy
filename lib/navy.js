var util = require('util'),
    events = require('events');

var aws      = require("aws-lib"),
    settings = require('../settings.js');

var ec2 = aws.createEC2Client(settings.awsAccessKeyId, 
                          settings.awsSecretAccessKey,
                          {'secure':true});

function Fleet (opts){
  events.EventEmitter.call(this);

  if (arguments.length !== 1
      || typeof opts !== 'object'
      || Object.keys(opts).length !== 5) {
    throw new Error('Must pass an options object with 5 properties.');
  }

  this.opts = opts;
  this.instances = {};
  this.getFleetStatusTries = 0;
  this.maxGetFleetStatusTries = 10;
}
util.inherits(Fleet, events.EventEmitter);

function deploy (){
  var self = this;
  console.log(this);
  ec2.call('RunInstances',
    {MinCount: this.opts.num,
     MaxCount: this.opts.num,
     ImageId: this.opts.ami,
     KeyName: this.opts.keyName,
     InstanceType: this.opts.instanceType,
     SecurityGroup: this.opts.secGroup
    }, function(err, results){
      self.deployCb.call(self, err, results);
    })
}
Fleet.prototype.deploy = deploy;

function deployCb (err,results){
  if (err){
    //what? just throw an error?
    throw new Error(err);
  }

  console.log(util.inspect(results,true,null,true));
  console.log(this);
  //Add the ec2 instances to the fleet object
  var insts = results.instancesSet.item;
  for (var i = 0; i < insts.length; i+=1){
    this.instances[insts[i].instanceId] = {
      'state':insts[i].instanceState.name,
      'domain':insts[i].dnsName
    }
  }

  //We're gonna have to poll aws till we see that
  //the instances are actually running.
  this.getFleetStatus();
}
Fleet.prototype.deployCb = deployCb;

function getFleetStatus(){
  var self = this;
  this.getFleetStatusTries += 1;
  var options = {};
  var insts = Object.keys(this.instances);
  for (var i = 0; i < insts.length; i += 1){
    options['InstanceId.'+i] = insts[i]
  }
  
  ec2.call('DescribeInstances', options, function(err, results){
    self.getFleetStatusCb.call(self, err, results);
  });
}
Fleet.prototype.getFleetStatus = getFleetStatus;

function getFleetStatusCb(err, results) {
  var self = this;
  console.log('THIS', this);
  if (err){
    //what? just throw an error?
    console.log('errOR', err);
    console.log('resulTS', results);
    //throw new Error(err);
  }

  var insts = results.reservationSet.item.instancesSet.item;

  //kinda hacky, but assume all are running
  var allRunning = true;
  //update fleet.instances with latest status
  for (var i = 0; i < insts.length; i += 1){
    this.instances[insts[i].instanceId].state = insts[i].instanceState.name;
    this.instances[insts[i].instanceId].domain = insts[i].dnsName;
    if (insts[i].instanceState.name !== 'running'){
      allRunning = false;
    }
  }

  if (allRunning) {
    console.log('fleetDeployed');
    this.emit('fleetDeployed');
  } else if (this.getFleetStatusTries < this.maxGetFleetStatusTries) {
    //Arbitrarily setting 4 as the max times
    //we'll check to see if our instances are running yet.
    //should we do a setTimeout for this?
    setTimeout(function(){
      self.getFleetStatus();
    }, 5000);
  } else {
    throw new Error('These instances just won\'t start. Sorry.');
  }

}
Fleet.prototype.getFleetStatusCb = getFleetStatusCb;

exports.Fleet = Fleet;
