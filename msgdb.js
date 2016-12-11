'use strict';

module.exports.index = (event, context, callback) => {
  const AWS = require('aws-sdk');
  const dynamo = new AWS.DynamoDB.DocumentClient();
  console.log(event.pathParameters.node_serial)
  var params = {
    TableName: 'mqtt_log',
    KeyConditionExpression: "node_serial = :node_serial",
    ExpressionAttributeValues : {':node_serial' : event.pathParameters.node_serial}
  };

  dynamo.query(params, function(err, data) {
    var response = {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  
    if (err) {
      console.log("Error", err)
      response = {
        statusCode: 500,
        body: err
      };
    }

    callback(null, response);
  });
};