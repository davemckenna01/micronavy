var util = require('util');

var aws      = require("aws-lib"),
    settings = require('../settings.js');

var ec2 = aws.createEC2Client(settings.awsAccessKeyId, 
                          settings.awsSecretAccessKey,
                          {'secure':true});

function Fleet (opts){

  if (arguments.length !== 1
      || typeof opts !== 'object'
      || Object.keys(opts).length !== 5) {
    throw new Error('Must pass an options object with 5 properties.');
  }

  this.opts = opts;
  this.instances = {};
}

function deploy (){

  ec2.call('RunInstances',
    {MinCount: this.opts.num,
     MaxCount: this.opts.num,
     ImageId: this.opts.ami,
     KeyName: this.opts.keyName,
     InstanceType: this.opts.instanceType,
     SecurityGroup: this.opts.secGroup
    }, this.deployCb)
}
Fleet.prototype.deploy = deploy;

function deployCb (err,results){
  //Callback
  //Add the ec2 instances to the fleet object
  console.log(err);
  console.log(util.inspect(results,true,null,true));

  var instanceItems = results.instanceSet.item;
  for (var i = 0; i < instanceItems.length; i+=1){
    this.instances[instanceItems[i].instanceId] = {
      'state':instanceItems[i].instanceStae.name,
      'domain':''
    }
  }

  this.getFleetStatus();
}
Fleet.prototype.deployCb = deployCb;

function getFleetStatus(){
  var options = {};
  var insts = Object.keys(this.instances);
  for (var i = 0; i < insts.length; i += 1){
    options['InstanceId.'+i] = insts[i]
  }
  
  ec2.call('DescribeInstances', options, this.getFleetStatusCb);
}
Fleet.prototype.getFleetStatus = getFleetStatus;

function getFleetStatusCb(err, results) {
  console.log(err);
  console.log(util.inspect(results,true,null,true));

}
Fleet.prototype.getFleetStatusCb = getFleetStatusCb;

exports.Fleet = Fleet;
