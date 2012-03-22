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

    this.runInstancesResult = {
      instancesSet: {
        item: [
          {
            instanceId: 'i-abc123',
            dnsName: '123-etc-ec2.aws.com',
            instanceState: {
              code: '0',
              name: 'pending'
            }
          },
          {
            instanceId: 'i-abc456',
            dnsName: '456-etc-ec2.aws.com',
            instanceState: {
              code: '0',
              name: 'pending'
            }
          }
        ]
      }
    }

    sinon.stub(navy.Fleet.prototype.aws, 'createEC2Client', function(){
      return {call:function(){}};
    });

  });

  teardown(function(){
    //Sometimes we restore this puppy  in tests... so check that
    //it's restorable first.
    if(navy.Fleet.prototype.aws.createEC2Client.restore) {
      navy.Fleet.prototype.aws.createEC2Client.restore();
    }
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

    test('should call fleet.aws.createEC2Client', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.connect();
      assert.ok(fleet.aws.createEC2Client.calledOnce);

    });

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

  suite('deployCb()', function(){
    test('should be called as a result of deploy()', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.connect();
      fleet.deployCb = sinon.spy();
      sinon.stub(fleet.ec2, 'call', function(){
        if (typeof arguments[2] === 'function'){
          //this is anon fn that wraps fleet.deployCb()
          arguments[2].call(fleet);
        }
      });
      fleet.deploy();
      assert.ok(fleet.deployCb.calledOnce);
    });

    test('should receive null for error, and an obj for results if api call success', function(){
      var runInstancesResult = this.runInstancesResult;
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.connect();
      fleet.deployCb = sinon.spy();
      sinon.stub(fleet.ec2, 'call', function(){
        if (typeof arguments[2] === 'function'){
          //this is anon fn that wraps fleet.deployCb()
          arguments[2].call(fleet, null, runInstancesResult);
        }
      });
      fleet.deploy();
      assert.ok(fleet.deployCb.calledWith(null, runInstancesResult));
    });

    test('should throw an error if it gets a string in the error arg (1st arg)', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.connect();
      sinon.spy(fleet, 'deployCb');
      sinon.stub(fleet.ec2, 'call', function(){
        if (typeof arguments[2] === 'function'){
          //this is anon fn that wraps fleet.deployCb()
          arguments[2].call(fleet, 'error string');
        }
      });

      try {
        fleet.deploy();
      } catch (e){}

      assert.ok(fleet.deployCb.threw());
    });

    test('should add ec2 instance data to the fleet object', function(){
      var runInstancesResult = this.runInstancesResult;
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.connect();
      sinon.stub(fleet.ec2, 'call', function(){
        if (typeof arguments[2] === 'function'){
          //this is anon fn that wraps fleet.deployCb()
          arguments[2].call(fleet, null, runInstancesResult);
        }
      });
      fleet.deploy();
      assert.equal(
        runInstancesResult.instancesSet.item.length,
        Object.keys(fleet.instances).length
      );

      var inst1 = runInstancesResult.instancesSet.item[0]
      var inst2 = runInstancesResult.instancesSet.item[1]
      assert.ok(fleet.instances[inst1.instanceId]);
      assert.ok(fleet.instances[inst2.instanceId]);

      assert.equal(fleet.instances[inst1.instanceId].state, inst1.instanceState.name);
      assert.equal(fleet.instances[inst1.instanceId].domain, inst1.dnsName);

      assert.equal(fleet.instances[inst2.instanceId].state, inst2.instanceState.name);
      assert.equal(fleet.instances[inst2.instanceId].domain, inst2.dnsName);

    });
  });

  //suite('playground', function(){

  //  test('do stuff', function(done){

  //    navy.Fleet.prototype.aws.createEC2Client.restore();
  //    var fleet = new navy.Fleet(this.fleetOpts);
  //    
  //    fleet.connect();

  //    fleet.deploy();

  //  });

  //});

});
