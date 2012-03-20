var util = require('util');

var aws      = require("aws-lib"),
    settings = require('./settings.js');

ec2 = aws.createEC2Client(settings.awsAccessKeyId, 
                          settings.awsSecretAccessKey,
                          {'secure':true});

ec2.call("DescribeInstances", {}, function(err, result) {
    console.log(util.inspect(result,true,null,true));
});

ec2.call("RudnInstances",
  {MinCount: 2,
   MaxCount: 2,
   ImageId: 'ami-a7f539ce',
   KeyName: 'ec21',
   InstanceType: 't1.micro',
   SecurityGroup: 'default'
  }, 
  function(err, result) {
    console.log(util.inspect(result,true,null,true));
  }
);
