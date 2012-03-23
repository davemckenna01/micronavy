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
    //Sometimes we restore this puppy in tests... so check that
    //it's restorable first.
    if(navy.Fleet.prototype.aws.createEC2Client.restore) {
      navy.Fleet.prototype.aws.createEC2Client.restore();
    }
  });

  suite('constructor', function(){

    test('should take an options obj arg of len 5', function(){
      assert.throws(function(){
        new navy.Fleet();
      }, 'Error');
      assert.throws(function(){
        new navy.Fleet('foo');
      }, 'Error');
      assert.throws(function(){
        new navy.Fleet({a:1});
      }, 'Error');
      assert.doesNotThrow(function(){
        var fleet = new navy.Fleet({a:1,b:2,c:3,d:4,e:5});
      });
    });

    test('should init some props based on passed options obj arg', function(){
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
    test('should call ec2 api via fleet.ec2.call with arg 1: "RunInstances", arg 2: obj w/ props equal to fleet.opts, and arg 3: an anonymous fn', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.ec2 = {call: sinon.spy()};
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

    test('should call fleet.deployCb()', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.ec2 = {call:function(){}};
      sinon.stub(fleet.ec2, 'call', function(){
        if (typeof arguments[2] === 'function'){
          //this is anon fn that wraps fleet.deployCb()
          arguments[2].call();
        }
      });
      fleet.deployCb = sinon.spy();
      fleet.deploy();

      assert.ok(fleet.deployCb.calledOnce);
    });
  });

  suite('deployCb()', function(){

    test('should throw an error if error arg (1st) is not null', function(){
      var fleet = new navy.Fleet(this.fleetOpts);

      assert.throws(function(){
        fleet.deployCb('an error');
      });
      assert.throws(function(){
        fleet.deployCb({});
      });
    });

    test('should add ec2 instance data to the fleet object', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      //stub getFleetStatus to make sure we don't execute 
      //further stuff.. since it's called at end of deployCb()
      sinon.stub(fleet, 'getFleetStatus');
      fleet.deployCb(null, this.runInstancesResult);

      var inst1 = this.runInstancesResult.instancesSet.item[0]
      var inst2 = this.runInstancesResult.instancesSet.item[1]

      assert.equal(
        this.runInstancesResult.instancesSet.item.length,
        Object.keys(fleet.instances).length
      );
      assert.equal(fleet.instances[inst1.instanceId].state, inst1.instanceState.name);
      assert.equal(fleet.instances[inst1.instanceId].domain, inst1.dnsName);
      assert.equal(fleet.instances[inst2.instanceId].state, inst2.instanceState.name);
      assert.equal(fleet.instances[inst2.instanceId].domain, inst2.dnsName);
    });

    test('should call fleet.getFleetStatus()', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.getFleetStatus = sinon.spy();
      fleet.deployCb(null, this.runInstancesResult);

      assert.ok(fleet.getFleetStatus.calledOnce);
    });
  });

  suite('getFleetStatus()', function(){
    test('should call ec2 api via fleet.ec2.call with arg 1: "DescribeInstances", arg 2: obj w/ props somewhat equal to fleet.instances, and arg 3: an anonymous fn', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.ec2 = {call:sinon.spy()};

      //Putting the fleet object in a "post-deploy()" state
      var inst1 = this.runInstancesResult.instancesSet.item[0]
      var inst2 = this.runInstancesResult.instancesSet.item[1]
      fleet.instances[inst1.instanceId] = {
        status: inst1.instanceState.name,
        domain: inst1.dnsName
      }
      fleet.instances[inst2.instanceId] = {
        status: inst2.instanceState.name,
        domain: inst2.dnsName
      }

      fleet.getFleetStatus.call(fleet)

      //constructing a similar object to what will be passed to ec2.call
      var options = {};
      var insts = Object.keys(fleet.instances);
      for (var i = 0; i < insts.length; i += 1){
        options['InstanceId.'+i] = insts[i]
      }

      assert.ok(fleet.ec2.call.calledOnce);
      assert.ok(fleet.ec2.call.calledWith('DescribeInstances', options));
      assert.isFunction(fleet.ec2.call.getCall(0).args[2]);
    });

    test('should keep track of the # of it\'s attempts', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.ec2 = {call: sinon.stub()};

      //Putting the fleet object in a "post-deploy()" state
      var inst1 = this.runInstancesResult.instancesSet.item[0]
      var inst2 = this.runInstancesResult.instancesSet.item[1]
      fleet.instances[inst1.instanceId] = {
        status: inst1.instanceState.name,
        domain: inst1.dnsName
      }
      fleet.instances[inst2.instanceId] = {
        status: inst2.instanceState.name,
        domain: inst2.dnsName
      }

      fleet.getFleetStatus.call(fleet);
      assert.equal(1, fleet.getFleetStatusTries);
      fleet.getFleetStatus.call(fleet);
      assert.equal(2, fleet.getFleetStatusTries);
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
