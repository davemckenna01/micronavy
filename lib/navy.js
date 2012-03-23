var util     = require('util'),
    events   = require('events'),
    aws      = require("aws-lib"),
    settings = require('../settings.js');

function Fleet (opts){
  //1. initializes some basic fleet object props

  events.EventEmitter.call(this);

  if (arguments.length !== 1
      || typeof opts !== 'object'
      || Object.keys(opts).length !== 5) {
    throw new Error('Must pass an options object with 5 properties.');
  }

  this.opts = opts;
  this.instances = {};
  this.getFleetStatusTries = 0;
  this.maxGetFleetStatusTries = 20;
  this.deployed = false;
  this.armed = false;
  this.ec2 = null;

}
util.inherits(Fleet, events.EventEmitter);

Fleet.prototype.aws = aws;

Fleet.prototype.connect = function(){
  //1. creates an ec2 client and attaches to fleet object

  this.ec2 = this.__proto__.aws.createEC2Client(
    settings.awsAccessKeyId, 
    settings.awsSecretAccessKey,
    {'secure':true}
  );
}

function deploy (){
  //1. http request to ec2 api to create some number of
  //   instances with specific attributes
  //2. specifies a callback function that will handle
  //   the api result

  var self = this;
  this.ec2.call('RunInstances',
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
  //1. adds details about the created instances to
  //   a property on the fleet object
  //2. begins a polling routine that intermittently
  //   checks ec2 api to see if the created instances
  //   are running yet

  if (err !== null){
    //what? just throw an error?
    //Should we do something with it?
    throw err;
  }

  //Should probably validate results here to
  //make sure it's in the expected format...

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
  //1. asks ec2 api if the created instances are running yet
  //2. keeps track of how many times ec2 api has been asked this
  //3. specifies a callback function that will 
  //   handle the api result

  var self = this;

  this.getFleetStatusTries += 1;

  //constructing the query to ec2 regarding
  //the status of specific instances.
  //i.e. InstanceId.0 = 'i-abc123', ...
  var options = {};
  var insts = Object.keys(this.instances);
  for (var i = 0; i < insts.length; i += 1){
    options['InstanceId.'+i] = insts[i]
  }
  
  this.ec2.call('DescribeInstances', options, function(err, results){
    self.getFleetStatusCb.call(self, err, results);
  });
}
Fleet.prototype.getFleetStatus = getFleetStatus;

function getFleetStatusCb(err, results) {
  //1. updates the instance data with the latest 
  //   state of the instances (i.e. pending, running, etc)
  //2. Checks the status of the instances:
  //      a) if all are running, we can set up the instances
  //         for their jobs.
  //      b) if not, we'll check back in a few seconds.
  //      c) if the instances are still not running after
  //         a certain amount of time/tries, program ends in error.

  var self = this;
  if (err){
    //what? just throw an error?
    //Should we do something with it?
    throw err;
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
    this.deployed = true;
    //this.armCannons()
  } else if (this.getFleetStatusTries < this.maxGetFleetStatusTries) {
    //we'll check to see if our instances are running yet.
    //Let's give poor old aws a little time to work.
    setTimeout(function(){
      self.getFleetStatus();
    }, 5000);
  } else {
    throw {name: 'Error',
           message: 'These instances just won\'t start. Sorry.'
          }
  }

}
Fleet.prototype.getFleetStatusCb = getFleetStatusCb;

function armCannons(){

}
Fleet.prototype.armCanons = armCannons;


exports.Fleet = Fleet;
