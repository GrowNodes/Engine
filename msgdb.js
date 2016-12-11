'use strict';

module.exports.get = (event, context, callback) => {
  const AWS = require('aws-sdk');
  const dynamo = new AWS.DynamoDB.DocumentClient();

  const topic = decodeURIComponent(event.pathParameters.encoded_topic)
  
  console.log(topic)
  var params = {
    TableName: 'mqtt_log',
    IndexName: 'topicGSI',
    KeyConditionExpression: "topic = :topic",
    ExpressionAttributeValues : {
      ':topic': topic
    }
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