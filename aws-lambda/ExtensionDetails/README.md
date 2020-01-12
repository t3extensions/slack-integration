# Amazon Lambda Function: ExtensionDetails

## Description

Amazon Lambda function to read TYPO3 extension details from Amazon DynamoDB.


## Details

**Function name:** ``ExtensionDetails``

**Runtime:** Node.js 8.10


## Environment Variables

| Variable name: | Description:                           | Example:             |
| -------------- | -------------------------------------- | -------------------- |
| ``s3bucket``   | S3 bucket name for logging             | ``mybucket``         |
| ``region``     | Geographical region of Amazon DynamoDB | ``us-east-1``        |
| ``tablename``  | Amazon DynamoDB table name             | ``typo3_extensions`` |
| ``token``      | Verification token (*)                 | ...                  |

\*) Request will be rejected, if verification tokens do not match, see below.


## Further Settings

**Memory:** 128 MB

**Timeout:** 10 seconds


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

curl -s -X POST -d @/tmp/data.tmp https://slack.t3extensions.org/v1/ExtensionDetails
```


## Slack Configuration

1. Create a new App ("build")
2. Enter a name, for example "TYPO3 Extensions" or "t3extensions.org".
3. Add a new "Slash Command".
4. Command: `/extension`.
5. Request URL: `https://slack.t3extensions.org/v1/ExtensionDetails`
6. Short Description: `Show extension details`.
7. Usage Hint: `<extensionkey>`
8. The "Verification Token" for this App (under "App Credentials") needs to be configured at Amazon Lambda.

Other details such as *ClientID* and *Client Secret* are not required.
