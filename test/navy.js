var assert = require('assert'),
    util   = require('util'),
    navy = require('../lib/navy.js');

suite('Fleet', function(){

  setup(function(){
    this.fleetOpts = {
      num: 2,
      ami: 'ami-a7f539ce',
      keyName: 'ec21',
      instanceType: 't1.micro',
      secGroup: 'default'
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
        new navy.Fleet({foo:1});
      }, 'Error');

      assert.deepEqual(new navy.Fleet(this.fleetOpts).opts, this.fleetOpts);
      
    });

  });
/*
  suite('deploy()', function(){

    test('should take one argument, a callback fn', function(){
      var fleet = new navy.Fleet(this.fleetOpts);

      assert.throws(function(){
        fleet.deploy()
      }, 'Error');

      assert.throws(function(){
        fleet.deploy('foo')
      }, 'Error');

      assert.doesNotThrow(function(){
        fleet.deploy(function(){})
      }, 'Error');
    });

    test('should call the ec2 callback', function(done){
      var fleet = new navy.Fleet(this.fleetOpts);

      fleet.deploy(function(err, results){
        
        fleet.deployCallback(err, results);
        done();
      });
      
    });

  });
*/
  suite('getFleetStatus()', function(){

    test('foo', function(done){
      
      var fleet = new navy.Fleet(this.fleetOpts);

      fleet.instances = {'i-c11c51a5':{},'i-c31c51a7':{}};

      var origCb = fleet.getFleetStatusCb;
      fleet.getFleetStatusCb = function(err, results){
        //Overriding and wrapping for the sake of testing
        fleet.getFleetStatusCb = origCb;
        fleet.getFleetStatusCb(err, results);
        done();

      }
      fleet.getFleetStatus();
    });

  });
});
