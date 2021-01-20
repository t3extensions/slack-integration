# Amazon Lambda Function: ExtensionDetails

## Description

Amazon Lambda function to read TYPO3 extension details from the TYPO3 Extension Repository (TER) and show the details in a Slack channel.


## Details

**Function name:** ``ExtensionDetails``

**Runtime:** Node.js 12.x


## Environment Variables

| Variable name:       | Description:                           | Example:                 |
| -------------------- | -------------------------------------- | ------------------------ |
| ``SLACK_TOKEN``      | Slack verification token (*)           | ...                      |
| ``TER_ACCESS_TOKEN`` | TER access token                       | ...                      |
| ``TER_HOSTNAME``     | Amazon DynamoDB table name             | ``extensions.typo3.org`` |
| ``TER_PATH``         | Amazon DynamoDB table name             | ``/api/v1/extension/``   |

\*) Request will be rejected, if verification tokens do not match, see below.


## Further Settings

**Memory:** 128 MB

**Timeout:** 5 seconds


## Testing

```bash
TOKEN="<verification-token>"

cat <<EOF > /tmp/data.tmp
token=${TOKEN}
&channel_name=test
&user_name=Steve
&command=/extension
&text=news
EOF

curl -s -X POST -d @/tmp/data.tmp https://slack.t3extensions.org/v2/ExtensionDetails
```

Typical response:

```json
{
  "response_type": "in_channel",
  "attachments": [
    {
      "title": "News system :black_small_square: EXT:news",
      "fallback": "News system",
      "mrkdwn_in": ["text"],
      "color": "#ff8700",
      "fields": [
        {
          "title": "Latest version",
          "value": "8.5.2",
          "short": true
        },
        {
          "title": "Last update",
          "value": "12/Jan/2021 (9 days ago)",
          "short": true
        },
        {
          "title": "Download",
          "value": "<https://extensions.typo3.org/extension/download/news/8.5.2/zip|ZIP file>",
          "short": true
        },
        {
          "title": "Code Insight",
          "value": "Git repository at <https://github.com/georgringer/news|GitHub>",
          "short": true
        },
        {
          "title": "Description",
          "value": "Versatile news extension, based on extbase & fluid. Editor friendly, default integration of social sharing and many other features",
          "short": false
        }
      ],
      "footer": "Powered by <https://t3extensions.org|t3extensions.org>",
      "text": "Author: Georg Ringer",
      "thumb_url": "https://www.gravatar.com/avatar/db78acc463be503b5aee097284070dea"
    }
  ]
}
```

Error response:

```json
{
  "response_type": "ephemeral",
  "attachments": [
    {
      "text": "*Oops, an error occurred.* :dizzy_face:",
      "mrkdwn_in": ["text"],
      "color": "#ff0000",
      "fields": [
        {
          "value": "Configuration error (security token mismatch).",
          "short": false
        }
      ],
      "footer": "Powered by <https://t3extensions.org|t3extensions.org>"
    }
  ]
}
```

## Slack Configuration

1. Create a new App ("build")
2. Enter a name, for example "TYPO3 Extensions" or "t3extensions.org".
3. Add a new "Slash Command".
4. Command: `/extension`.
5. Request URL: `https://slack.t3extensions.org/v2/ExtensionDetails`
6. Short Description: `Show extension details`.
7. Usage Hint: `<extensionkey>`
8. The "Verification Token" for this App (under "App Credentials") needs to be configured at Amazon Lambda.

Other details such as *ClientID* and *Client Secret* are not required.
