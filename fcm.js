'use strict';
const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
const request = require('request');


const gcmRequest = (obj, callback) => {
  var options = {
    url: 'https://android.googleapis.com/gcm/notification',
    method: 'POST',
    headers: {
      'project_id': 527579000683,
      'Authorization': 'key=AAAAetYor2s:APA91bHkaQM2PAmL8rODHC4ChVSFpADsi9JXJoVzAVb4FnuMnio55OONzSfEBffVIXuB3otnKE88O3MQp6kSURnoUIY2SBmw0SHI9GXsADE-vt2T3s1e4Lz4QFjJccfo2W1ZF1nu00h_csyr70b6_kzOm38DBPlqqg'
    },
    json: obj
  }

  request(options, function (error, response, body) {
    console.log(body)
    if (!error && response.statusCode == 200) {
        callback(body)
    } else {
      callback(error)
    }
  })
}

const ddbUpdateUserAndKeys = (uid, rids_arr, notification_key, callback) => {
  console.log("uid and key:", uid, notification_key)
  const item = {
    TableName: 'user_fcm_tokens',
    Item: {
      uid,
      notification_key,
      registration_ids: rids_arr
    }
  };

  // write the todo to the database
  dynamo.put(item, (error, result) => {
    // handle potential errors
    if (error) {
      console.error(error); // eslint-disable-line no-console
      callback(new Error('ddbUpdateUserAndKeys failed for uid, rid, notification_key'));
      return;
    }
    callback()
  });
}

module.exports.attach = (event, context, callback) => {

  const params = JSON.parse(event.body)

  var query = {
    TableName: 'user_fcm_tokens',
    KeyConditionExpression: "uid = :uid",
    ExpressionAttributeValues : {
      ':uid': params.uid
    }
  };
  dynamo.query(query, function(err, data) {
    if (err) {
      console.log("Error", err)
      callback(null, {statusCode: 500, body: err})

    } else if (data.Count === 0) {
    // if user doesn't have notification key
    // post request create notification key from registration id
    // create entry in DB
      gcmRequest({
        "operation": "create",
        "notification_key_name": params.uid,
        "registration_ids": [params.rid]
      }, (fcm_response) => {
          ddbUpdateUserAndKeys(params.uid, [params.rid], fcm_response.notification_key, () => {
            callback(null, {statusCode: 201})
          })
      })

    } else {
    // user has notification key
    // look up user in DB
    // post request to add registration id
    // add registration id to DB entry
    // update notification key in DB
      gcmRequest({
        "operation": "add",
        "notification_key_name": params.uid,
        "notification_key": data.items[0].notification_key,
        "registration_ids": [params.rid]
      }, (fcm_response) => {
          const new_rids_arr = data.items[0].registration_ids.push(params.rid)
          ddbUpdateUserAndKeys(params.uid, new_rids_arr, fcm_response.notification_key, () => {
            callback(null, {statusCode: 201, body: JSON.stringify(fcm_response)})
          })
      })
    }
  });
};



module.exports.detach = (event, context, callback) => {
  
  const params = JSON.parse(event.body)

  var query = {
    TableName: 'user_fcm_tokens',
    KeyConditionExpression: "uid = :uid",
    ExpressionAttributeValues : {
      ':uid': params.uid
    }
  };
  dynamo.query(query, function(err, data) {
    if (err || data.Count === 0) {
      console.log("Error", err)
      const response = {
        statusCode: 500,
        body: err || "Tried to detach registration_id but user id not found in DDB!"
      };
      callback(null, response)

    } else {
      gcmRequest({
        "operation": "remove",
        "notification_key_name": params.uid,
        "notification_key": data.items[0].notification_key,
        "registration_ids": [params.rid]
      }, (fcm_response) => {
          var rids_arr = data.items[0].registration_ids
          var index = rids_arr.indexOf(params.rid);
          if (index >= 0) {
            rids_arr.splice( index, 1 );
          }

          ddbUpdateUserAndKeys(params.uid, rids_arr, fcm_response.notification_key, () => {
            callback(null, {statusCode: 201, body: JSON.stringify(fcm_response)})
          })
      })
    }
  });
};