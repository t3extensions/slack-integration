/**
 * AWS Lambda function: ExtensionDetails
 * Author: Michael Schams <t3extensions.org>
 * Version: 1.0.6
 */

'use strict';

const QS = require('querystring');
const AWS = require('aws-sdk');

// Read environment variables
const REGION = process.env.region;
const TABLENAME = process.env.tablename;
const TOKEN = process.env.token;
const S3BUCKET = process.env.s3bucket;

// Set region
AWS.config.update({region: REGION});

// Convert timestamp into human-readable date/time format
var DateFormat = function (time, format) {
    if (time == undefined || time == '' || time == 0) {
        var t = new Date();
    } else {
        var t = new Date(time);
    }
    var tf = function (i) { return (i < 10 ? '0' : '') + i };
    var m = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
    return format.replace(/YYYY|MM|BBB|DD|hh|mm|ss/g, function (a) {
        switch (a) {
            case 'YYYY':
                return tf(t.getFullYear());
                break;
            case 'MM':
                return tf(t.getMonth() + 1);
                break;
            case 'BBB':
                return m[t.getMonth()];
                break;
            case 'DD':
                return tf(t.getDate());
                break;
            case 'hh':
                return tf(t.getHours());
                break;
            case 'mm':
                return tf(t.getMinutes());
                break;
            case 'ss':
                return tf(t.getSeconds());
                break;
        }
    })
};

// Log event as an object into a S3 bucket
var Logging = function (bucket, key, data) {
    var s3 = new AWS.S3();
    var params = {
        Bucket: bucket,
        Key: key,
        Body: data
    }

    s3.putObject(params, function (error, data) {
        if (error) {
            // an error occurred
        } else {
            // successful response
        }
    });
}

// Main index handler
exports.handler = (event, context, callback) => {
    // Parse query string (request payload)
    const params = QS.parse(event.body);

    // Set default response data
    var responseType = "ephemeral";
    var responseText = "Sorry, request failed";

    // Extract data from request
    var user = params.user_name;
    var command = params.command;
    var channel = params.channel_name;
    var commandText = params.text;
    var slackToken = params.token;

    var currentTimestamp = DateFormat(0, 'DD/BBB/YYYY hh:mm:ss');
    var s3_path = DateFormat(0, 'YYYY/MM-BBB/YYYYMMDD-hhmmss') + '.' + context.functionName + '.log';

    var log = [
        "timestamp............: " + currentTimestamp,
        "region...............: " + REGION,
        "dynamodb_table.......: " + TABLENAME,
        "s3_bucket............: " + S3BUCKET,
        "s3_path..............: " + s3_path,
        "lambda_token.........: " + TOKEN,
        "slack_token..........: " + slackToken,
        "slack_user...........: " + user,
        "slack_command........: " + command,
        "slack_channel........: " + channel,
        "slack_command_text...: " + commandText,
        "context_request_id...: " + context.awsRequestId
    ];

    // Prepare call to Amazon DynamoDB
    var table = new AWS.DynamoDB({
        apiVersion: '2012-08-10',
        params: {
            TableName: TABLENAME
        }
    });

//    var extension_key = commandText.substr(0, commandText.indexOf(' '));
    var extension_key = commandText.toLowerCase();
    var thisRegex = new RegExp('^\[a-z0-9_\]{3,}$');

    // Ensure, Slack command passes a valid extension key
    if (!thisRegex.test(extension_key)) {
        log.push("error................: invalid call or extension key");
        callback(null, {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "response_type": "ephemeral",
                "attachments": [
                    {
                        "pretext": "Sorry, this was an invalid call or extension key. Try \"/extension <extensionkey>\", for example \"/extension powermail\"",
                        "color": "#ff8700"
                    }
                ]
            })
        });
    } else if (slackToken !== TOKEN) {
        log.push("error................: token mismatch");
        callback(null, {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "response_type": "ephemeral",
                "attachments": [
                    {
                        "pretext": "Security token mismatch! This seems to be a configuration error.\nIf you could send a direct message to @michael.schams to investigate this issue, that would be awesome!",
                        "color": "#ff8700"
                    }
                ]
            })
        });

    } else {
        // Retrieve extension data from Amazon DynamoDB
        var itemParams = {Key: {'extension_key': {S: extension_key} }};
        table.getItem(itemParams, function(error, data) {
            if (error) {
                // An error occurred
                responseType = "ephemeral";
                log.push("error................: " + error);
                log.push("error_stack..........: " + error.stack);
                callback(error);
            } else if (data.Item) {

                // Successful
                responseType = "in_channel";
                responseText = "EXT:" + data.Item.extension_key["S"] + " " + data.Item.version["S"] + " by " + data.Item.author_name["S"];

                // Convert last update timestamp into human readable format
                var lastUpdate = DateFormat((parseInt(data.Item.last_updated["N"]) * 1000), 'DD/BBB/YYYY');

                callback(null, {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        "response_type": responseType,
                        "attachments": [
                            {
                                "pretext": "<https://extensions.typo3.org/extension/" + data.Item.extension_key["S"] + "|" + data.Item.title["S"] + ">",
                                "fallback": data.Item.title["S"],
                                "color": "#ff8700",
                                "fields": [
                                    {
                                        "title": "Extension key",
                                        "value": data.Item.extension_key["S"],
                                        "short": true
                                    },
                                    {
                                        "title": "Author",
                                        "value": data.Item.author_name["S"],
                                        "short": true
                                    },
                                    {
                                        "title": "Latest version",
                                        "value": data.Item.version["S"],
                                        "short": true
                                    },
                                    {
                                        "title": "Last update",
                                        "value": lastUpdate,
                                        "short": true
                                    },
                                    {
                                        "title": "Description",
                                        "value": data.Item.description["S"],
                                        "short": false
                                    }
                                ],
                                "footer": "Powered by <https://t3extensions.org|t3extensions.org> (suggested by @" + user  + ")\n[" + context.awsRequestId + "]"
                            }
                        ]
                    })
                });
            } else {
                log.push("error................: extension key not found");
                callback(null, {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        "response_type": "ephemeral",
                        "attachments": [
                            {
                                "pretext": "Sorry, could not find any extension with the extension key \"" + commandText + "\"",
                                "color": "#ff8700"
                            }
                        ]
                    })
                });
            }
        });
    }

    // Write log
    Logging(S3BUCKET, s3_path, log.join("\n") + "\n");
};
