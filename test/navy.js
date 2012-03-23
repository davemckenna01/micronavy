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
            dnsName: {},
            instanceState: {
              name: 'pending'
            }
          },
          {
            instanceId: 'i-abc456',
            dnsName: {},
            instanceState: {
              name: 'pending'
            }
          }
        ]
      }
    }

    this.describeInstancesResult = {
      reservationSet : {
        item: {
          instancesSet: {
            item: [
              {
                instanceId: 'i-abc123',
                dnsName: {},
                instanceState: {
                  name: ''
                }
              },
              {
                instanceId: 'i-abc456',
                dnsName: {},
                instanceState: {
                  name: ''
                }
              }
            ]
          }
        }
      }
    }

    this.postDeployify = function(fleetObj, testEnv){
      //Putting the fleet object in a "post-deploy()" state
      var inst1 = testEnv.runInstancesResult.instancesSet.item[0]
      var inst2 = testEnv.runInstancesResult.instancesSet.item[1]
      fleetObj.instances[inst1.instanceId] = {
        state: inst1.instanceState.name,
        domain: inst1.dnsName
      }
      fleetObj.instances[inst2.instanceId] = {
        state: inst2.instanceState.name,
        domain: inst2.dnsName
      }

      return fleetObj;
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

      fleet = this.postDeployify(fleet, this);

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

      fleet = this.postDeployify(fleet, this);

      fleet.getFleetStatus.call(fleet);
      assert.equal(1, fleet.getFleetStatusTries);
      fleet.getFleetStatus.call(fleet);
      assert.equal(2, fleet.getFleetStatusTries);
    });

    test('should call fleet.getFleetStatusCb()', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.ec2 = {call:function(){}};
      sinon.stub(fleet.ec2, 'call', function(){
        if (typeof arguments[2] === 'function'){
          //this is anon fn that wraps fleet.getFleetStatusCb()
          arguments[2].call();
        }
      });
      fleet.getFleetStatusCb = sinon.spy();

      fleet = this.postDeployify(fleet, this);

      fleet.getFleetStatus.call(fleet);

      assert.ok(fleet.getFleetStatusCb.calledOnce);
    });
  });

  suite('getFleetStatusCb()', function(){
    test('should throw an error if error arg (1st) is not null', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.armCannons = sinon.stub();

      assert.throws(function(){
        fleet.getFleetStatusCb('an error');
      });
      assert.throws(function(){
        fleet.getFleetStatusCb({});
      });
    });

    test('should update feet.instances with latest data', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.armCannons = sinon.stub();
      fleet.getFleetStatus = sinon.spy();
      fleet.awsPollingInterval = 10;
      fleet = this.postDeployify(fleet, this);

      var insts = this.describeInstancesResult.reservationSet.item.instancesSet.item;
      insts[0].instanceState.name = 'running';
      insts[0].dnsName = 'ec2-123.aws.com';
      insts[1].instanceState.name = 'someOtherStatus';
      insts[1].dnsName = {};
      this.describeInstancesResult.reservationSet.item.instancesSet.item = insts;

      fleet.getFleetStatusCb(null, this.describeInstancesResult);

      assert.equal(
        insts.length,
        Object.keys(fleet.instances).length
      )
      assert.equal(fleet.instances[insts[0].instanceId].state, 'running');
      assert.equal(fleet.instances[insts[0].instanceId].domain, 'ec2-123.aws.com');
      assert.equal(fleet.instances[insts[1].instanceId].state, 'someOtherStatus');
      assert.deepEqual(fleet.instances[insts[1].instanceId].domain, {});

    });

    test('should update fleet.allInstancesRunning', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.armCannons = sinon.stub();
      fleet.getFleetStatus = sinon.spy();
      fleet.awsPollingInterval = 10;
      fleet = this.postDeployify(fleet, this);

      var insts = this.describeInstancesResult.reservationSet.item.instancesSet.item;
      insts[0].instanceState.name = 'running';
      insts[1].instanceState.name = 'someOtherStatus';
      this.describeInstancesResult.reservationSet.item.instancesSet.item = insts;

      fleet.getFleetStatusCb(null, this.describeInstancesResult);

      assert.ok(!fleet.allInstancesRunning);

      insts[1].instanceState.name = 'running';
      this.describeInstancesResult.reservationSet.item.instancesSet.item = insts;

      fleet.getFleetStatusCb(null, this.describeInstancesResult);

      assert.ok(fleet.allInstancesRunning);
    });
    
    test('should set fleet.deployed to true if all instances running', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.armCannons = sinon.stub();
      fleet.getFleetStatus = sinon.spy();
      fleet.awsPollingInterval = 10;
      fleet = this.postDeployify(fleet, this);

      var insts = this.describeInstancesResult.reservationSet.item.instancesSet.item;
      insts[0].instanceState.name = 'running';
      insts[1].instanceState.name = 'running';
      this.describeInstancesResult.reservationSet.item.instancesSet.item = insts;

      fleet.getFleetStatusCb(null, this.describeInstancesResult);

      assert.ok(fleet.deployed);
    });

    test('should call fleet.armCannons() if all instances running', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.armCannons = sinon.stub();
      fleet.getFleetStatus = sinon.spy();
      fleet.awsPollingInterval = 10;
      fleet = this.postDeployify(fleet, this);

      var insts = this.describeInstancesResult.reservationSet.item.instancesSet.item;
      insts[0].instanceState.name = 'running';
      insts[1].instanceState.name = 'running';
      this.describeInstancesResult.reservationSet.item.instancesSet.item = insts;

      fleet.getFleetStatusCb(null, this.describeInstancesResult);

      assert.ok(fleet.armCannons.calledOnce);
    });

    test('should call getFleetStatus if all instances are not running (polling mechanism)', function(done){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.getFleetStatus = sinon.spy();
      fleet.awsPollingInterval = 10;
      fleet = this.postDeployify(fleet, this);

      var insts = this.describeInstancesResult.reservationSet.item.instancesSet.item;
      insts[0].instanceState.name = 'running';
      insts[1].instanceState.name = 'someOtherState';
      this.describeInstancesResult.reservationSet.item.instancesSet.item = insts;

      //need to wrap the cb in a fn to test it since it's async
      var original = fleet.getFleetStatusPollCb;
      fleet.getFleetStatusPollCb = function(){
        fleet.getFleetStatusPollCb = original;
        fleet.getFleetStatusPollCb();

        assert.ok(fleet.getFleetStatus.calledOnce);
        done();
      }

      fleet.getFleetStatusCb(null, this.describeInstancesResult);

    });

    test('should throw an error if polling at the max # of tries', function(){
      var fleet = new navy.Fleet(this.fleetOpts);
      fleet.getFleetStatusTries = 2;
      fleet.maxGetFleetStatusTries = 2;
      fleet = this.postDeployify(fleet, this);

      var insts = this.describeInstancesResult.reservationSet.item.instancesSet.item;
      insts[0].instanceState.name = 'running';
      insts[1].instanceState.name = 'someOtherState';
      this.describeInstancesResult.reservationSet.item.instancesSet.item = insts;

      var self = this;

      assert.throws(function(){
        fleet.getFleetStatusCb(null, self.describeInstancesResult);
      });
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

