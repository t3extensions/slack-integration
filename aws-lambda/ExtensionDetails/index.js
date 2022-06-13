/**
 * ExtensionDetails
 *
 * (c)2020-2021 by Michael Schams <schams.net>
 * https://t3extensions.org
 * Version 2.01
 */

'use strict';
const query = require('querystring');
const https = require('https');
const util = require('util');
const crypto = require('crypto');

/**
 * Handler method invoked by Lambda runtime
 */
exports.handler = async (event, context, callback) => {
    // Parse query string (request payload)
    const params = query.parse(event.body);

    // Set default response data
    var responseData = {};

    // Extract data from request
    var user = params.user_name;
    var command = params.command;
    var channel = params.channel_name;
    var commandText = params.text || '';
    var slackToken = params.token || '';

    console.log('User: "' + user + '", command: "' + command + '", channel: "' + channel + '", commandText: "' + commandText + '"');

    var extensionKey = commandText.toLowerCase();
    var thisRegex = new RegExp('^\[a-z0-9_\]{3,}$');

    if (!thisRegex.test(extensionKey)) {
        console.log("Error: invalid call or extension key");
        responseData = await generateSlackFailedResponse("Invalid extension key.");
    } else if (!slackTokenMatch(slackToken)) {
        console.log("Error: Slack security token mismatch");
        responseData = await generateSlackFailedResponse("Configuration error (security token mismatch).");
    } else {
        console.log("Extension key: " + extensionKey);
        var data = '{}';
        const options = {
            method: 'GET',
            hostname: process.env.TER_HOSTNAME,
            path: process.env.TER_PATH + extensionKey,
            port: 443,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + process.env.TER_ACCESS_TOKEN
            }
        };
        var extensionDetails = await executeRequest(options, data);
        extensionDetails = JSON.parse(extensionDetails);
        console.log(util.inspect(extensionDetails, {
            depth: 5
        }));
        if (extensionDetails.hasOwnProperty(0) && typeof extensionDetails[0] === 'object' && extensionDetails[0] !== null) {
            // Success, extension details found
            responseData = await generateSlackSuccessResponse(extensionDetails[0]);
        } else {
            // Failed
            responseData = 'Something went wrong.';
            if (typeof extensionDetails === 'object' && extensionDetails !== null && extensionDetails.hasOwnProperty('error_description')) {
                responseData = await generateSlackFailedResponse(extensionDetails.error_description);
            }
        }
    }

    var response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(responseData)
    };
    callback(null, response);
};

/**
 * Execute HTTPS request to TYPO3 Extension Repository's API to retrieve extension details
 */
function executeRequest(options, data) {
    console.log('executeRequest()');
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            res.setEncoding('utf8');
            let responseBody = '';
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            res.on('end', () => {
                resolve(responseBody);
            });
        });
        req.on('error', (err) => {
            reject(err);
        });
        req.write(data);
        req.end();
    });
}

/**
 * Generate nicely formatted and styled Slack response
 * (see Slack API documentation for formatting options)
 */
function generateSlackSuccessResponse(extensionDetails) {

    const extensionKey = extensionDetails.key || 'n/a';
    const extensionTitle = extensionDetails.current_version.title || 'n/a';
    const extensionVersion = extensionDetails.current_version.number || 'n/a';
    const lastUpdate = getLastUpdate(extensionDetails.current_version.upload_date || 0);
    const extensionDescription = extensionDetails.current_version.description || 'n/a';
    const extensionAuthor = extractExtensionAuthor(extensionDetails.current_version.author || null);
    const extensionEmail = extractExtensionAuthorEmail(extensionDetails.current_version.author || null);
    const terLink = 'https://extensions.typo3.org/extension/' + extensionDetails.key;
    const zipDownloadLink = extensionDetails.current_version.download.zip || null;
    const t3xDownloadLink = extensionDetails.current_version.download.t3x || null;
    const repositoryLink = extensionDetails.meta.repository_url || null;
    const packagistDownloadLink = extensionDetails.meta.packagist || null;
    const typo3compatibility = extractVersionCompatibilities(extensionDetails.current_version.typo3_versions || null);
    const downloadLinks = getDownloadLinks(zipDownloadLink, t3xDownloadLink, packagistDownloadLink);

    var fields = [
        {
            "title": "Latest version",
            "value": extensionVersion,
            "short": true
        },
        {
            "title": "Last update",
            "value": lastUpdate,
            "short": true
        }
    ];

    // Download link: current_version.download.zip
    if (downloadLinks) {
        fields.push(
            {
                "title": "Download",
                "value": downloadLinks.join(' | '),
                "short": true
            }
        );
    }

    // Link to repository, formatted and clickable if possible
    if (repositoryLink) {
        fields.push(
            {
                "title": "Code Insight",
                "value": getRepositoryLink(repositoryLink),
                "short": true
            }
        );
    }

    // List of TYPO3 version compatibility (long format)
    if (typo3compatibility) {
        fields.push(
            {
                "title": "Compatibility",
                "value": 'TYPO3 ' + typo3compatibility,
                "short": true
            }
        );
    }

    // Link to the TYPO3 Extension Repository (TER)
    if (terLink) {
        fields.push(
            {
                "title": "Further details",
                "value":  "<" + terLink + "|TYPO3 Extension Repository>",
                "short": true
            }
        );
    }

    // Sanitized description (long format)
    if (extensionDescription) {
        fields.push(
            {
                "title": "Description",
                "value": extensionDescription.replace(/\s+/g, ' ').replace(/\n/g, ''),
                "short": false
            }
        );
    }

    var attachment = {
        "title": extensionTitle + " :black_small_square: EXT:" + extensionKey + "",
        //"text": "Extension key: `" + extensionKey + "`",
        //"text": "<https://extensions.typo3.org/extension/" + extensionKey + "|" + extensionTitle + ">",
        "fallback": extensionTitle,
        "mrkdwn_in": ["text"],
        "color": "#ff8700",
        "fields": fields,
        "footer": "Powered by <https://t3extensions.org|t3extensions.org>"
    };

    if (extensionAuthor) {
        //attachment.author_name = 'Author(s): ' + extensionAuthor;
        attachment.text = 'Author(s): ' + extensionAuthor;
        if (extensionEmail) {
            var extensionEmailHash = crypto.createHash('md5').update(extensionEmail).digest('hex');
            //attachment.author_icon = 'https://www.gravatar.com/avatar/' + extensionEmailHash;
            attachment.thumb_url = 'https://www.gravatar.com/avatar/' + extensionEmailHash + '?d=404';
        }
    }

    // ephemeral = visible only to user, in_channel = visible in channel
    return {
        "response_type": "in_channel",
        "attachments": [
            attachment
        ]
    };
}

/**
 * Generate Slack response in case of an error/issue
 * (only visible to the user who executed the Slash command)
 */
function generateSlackFailedResponse(message) {
    // ephemeral = visible only to user, in_channel = visible in channel
    return {
        "response_type": "ephemeral",
        "attachments": [
            {
                "text": "*Oops, an error occurred.* :dizzy_face:",
                "mrkdwn_in": ["text"],
                "color": "#ff0000",
                "fields": [
                    {
                        "value": message,
                        "short": false
                    }
                ],
                "footer": "Powered by <https://t3extensions.org|t3extensions.org>"
            }
        ]
    };
}

/**
 * Convert timestamp into human-readable date/time format
 * (used in getLastUpdate(), see below)
 */
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
            case 'MM':
                return tf(t.getMonth() + 1);
            case 'BBB':
                return m[t.getMonth()];
            case 'DD':
                return tf(t.getDate());
            case 'hh':
                return tf(t.getHours());
            case 'mm':
                return tf(t.getMinutes());
            case 'ss':
                return tf(t.getSeconds());
        }
    });
};

/**
 * Create a human-readable output of the last update timestamp
 * For example: "23/Mar/2021 (5 days ago)"
 */
function getLastUpdate(timestamp) {
    var string = '';
    if (timestamp && typeof timestamp == 'number' && timestamp > 0) {
        string = DateFormat((parseInt(timestamp) * 1000), 'DD/BBB/YYYY');
        const lastUpdate = new Date(parseInt(timestamp) * 1000);
        const today = new Date();
        const days = Math.ceil(Math.abs(today - lastUpdate) / (1000 * 60 * 60 * 24));
        if (days > 365) {
            return string + ' (more than a year ago)';
        } else if (days > 1) {
            return string + ' (' + days + ' days ago)';
        } else {
            return string + ' (just recently)';
        }
    }
    return 'unknown';
}

/**
 * Format link to repository
 */
function getRepositoryLink(repositoryLink) {
    var github = new RegExp('github\.com');
    var gitlab = new RegExp('gitlab\.com');
    var bitbucket = new RegExp('bitbucket\.com');
    if (github.test(repositoryLink)) {
        return "Git repository at <" + repositoryLink + "|GitHub>";
    } else if (gitlab.test(repositoryLink)) {
        return "Git repository at <" + repositoryLink + "|GitLab>";
    } else if (bitbucket.test(repositoryLink)) {
        return "Git repository at <" + repositoryLink + "|Bitbucket>";
    }
    return 'Code repository';
}

/**
 * Create list of download link(s)
 */
function getDownloadLinks(zipDownloadLink, t3xDownloadLink, packagistDownloadLink) {
    var downloadLinks = [];
    if (zipDownloadLink) {
        downloadLinks.push("<" + zipDownloadLink + "|ZIP>");
    }
    if (t3xDownloadLink) {
        downloadLinks.push("<" + t3xDownloadLink + "|T3X>");
    }
    if (packagistDownloadLink) {
        downloadLinks.push("<" + packagistDownloadLink + "|Packagist>");
    }
    return downloadLinks;
}

/**
 * Returns extension author name(s) if valid, or NULL otherwise
 */
function extractExtensionAuthor(extensionAuthor) {
    if (typeof extensionAuthor === 'string' && extensionAuthor !== null && extensionAuthor !== '') {
        return extensionAuthor;
    } else if (typeof extensionAuthor === 'object' && extensionAuthor !== null) {
        if (extensionAuthor.hasOwnProperty('name')) {
            console.log('extensionAuthor.name: ' + extensionAuthor.name)
            return extensionAuthor.name;
        }
    }
    return null;
}

/**
 * Returns extension author's email address if valid, or NULL otherwise
 */
function extractExtensionAuthorEmail(extensionAuthor) {
    if (typeof extensionAuthor === 'object' && extensionAuthor !== null) {
        if (extensionAuthor.hasOwnProperty('email')) {
            if (isValidateEmail(extensionAuthor.email)) {
                console.log('extensionAuthor.email: ' + extensionAuthor.email)
                return extensionAuthor.email;
            }
        }
    }
    return null;
}

/**
 * Returns a comma-separated list of TYPO3 versions as a string (or NULL)
 * For example: "v10, v11"
 */
function extractVersionCompatibilities(typo3versions) {
    var versionString = '';
    var pattern = new RegExp('[0-9]*');
    if (Array.isArray(typo3versions) && typo3versions !== null) {
        if (typo3versions.length > 0) {
            typo3versions.forEach(function (version, index) {
                if (pattern.test(version)) {
                    versionString = versionString + 'v' + version + ', ';
                }
            });
            // Remove the "," at the end:
            versionString = versionString.replace(/, $/, '');
            // Replace the last occurrence of "," with "and"
            versionString = versionString.replace(/,([^,]*)$/, ' and $1');
            // Remove double spaces
            versionString = versionString.replace(/\s\s+/g, ' ');
            console.log('TYPO3 compatibility: ' + versionString);
            return versionString;
        }
    }
    return null;
}

/**
 * Validates the syntax (format) of an email address
 */
function isValidateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

/**
 * Compares the token passed in the request with the token set as an environment variable
 */
function slackTokenMatch(tokenInRequest) {
    var tokenFromEnvironment = process.env.SLACK_TOKEN;
    var items = tokenFromEnvironment.split(/\s*,\s*/);
    return items.indexOf(tokenInRequest) > -1;
}
