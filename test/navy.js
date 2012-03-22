var assert = require('chai').assert,
    sinon  = require('sinon'),
    util   = require('util'),
    navy   = require('../lib/navy.js');

suite('Fleet', function(){

  setup(function(){
    //This will actually create stuff on aws - beware!
    this.LIVEfleetOpts = {
      num: 2,
      ami: 'ami-a7f539ce',
      keyName: 'ec21',
      instanceType: 't1.micro',
      secGroup: 'default'
    }

    this.fleetOpts = {
      num: 2,
      ami: 'someAmi',
      keyName: 'someKeyname',
      instanceType: 'someInstanceCode',
      secGroup: 'someSecurityGroup'
    }

    sinon.stub(navy.Fleet.prototype.aws, 'createEC2Client', function(){
      return {call:function(){}};
    });

  });

  teardown(function(){
   navy.Fleet.prototype.aws.createEC2Client.restore();
  });

  suite('constructor', function(){

    test('should take an options obj arg of len 5 and init some props', function(){
      assert.throws(function(){
        new navy.Fleet();
      }, 'Error');
      
      assert.throws(function(){
        new navy.Fleet('foo');
      }, 'Error');

      assert.throws(function(){
        new navy.Fleet({foo:1});
      }, 'Error');

      var fleet = new navy.Fleet(this.fleetOpts);
      assert.deepEqual(fleet.opts, this.fleetOpts);
      
      assert.isFalse(fleet.deployed);
      assert.isFalse(fleet.armed);
      assert.isNull(fleet.ec2);
      
    });

  });

  suite('connect()', function(){

    test('should set up a fleet.ec2 object', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.connect();
      assert.isObject(fleet.ec2);
      assert.ok(fleet.ec2.hasOwnProperty('call'));

    });

  });

  suite('deploy()', function(){
    ///////
    ///////////
    //NEEDS TO BE DELAYED (BC ITS ASYNC)!!!!!!!!!!!!!
    //USE SINON's timer thingy? or other async support?
    test('should call ec2 api via fleet.ec2.call with "RunInstances" as first arg, and obj w/ props = fleet.opts as second arg, and an anonymous fn as third arg', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.connect();
      sinon.spy(fleet.ec2, 'call');
      fleet.deploy();
      assert.ok(fleet.ec2.call.calledOnce);
      assert.ok(fleet.ec2.call.calledWith('RunInstances',
        {MinCount: this.fleetOpts.num,
         MaxCount: this.fleetOpts.num,
         ImageId: this.fleetOpts.ami,
         KeyName: this.fleetOpts.keyName,
         InstanceType: this.fleetOpts.instanceType,
         SecurityGroup: this.fleetOpts.secGroup
        }
      ));
      assert.isFunction(fleet.ec2.call.getCall(0).args[2]);
    });

  });

  //suite('deployCb()', function(){
  //  test('should be called after as a result of deploy()', function(){
  //    var fleet = new navy.Fleet(this.fleetOpts);
  //    fleet.connect();
  //    sinon.spy(fleet, 'deployCb');
  //    fleet.deploy();
  //  });
  //});

//  suite('getFleetStatus()', function(){
//
//    test('should return someting!!! err?', function(done){
//
//      var fleet = new navy.Fleet(this.fleetOpts);
//
//      fleet.instances = {'i-c11c51a5':{},'i-c31c51a7':{}};
//
//      var origCb = fleet.getFleetStatusCb;
//      fleet.getFleetStatusCb = function(err, results){
//        //Overriding and wrapping for the sake of testing
//        fleet.getFleetStatusCb = origCb;
//        fleet.getFleetStatusCb(err, results);
//        done();
//      }
//      fleet.getFleetStatus();
//    });
//
//  });



//  suite('playgound', function(){
//
//    test('do stuff', function(done){
//
//      var fleet = new navy.Fleet(this.fleetOpts);
//      fleet.deploy();
//
//    });
//
//  });

});
