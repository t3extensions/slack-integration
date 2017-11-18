# Amazon Lambda Function: ExtensionDetails

## Description

Amazon Lambda function to read TYPO3 extension details from Amazon DynamoDB.


## Details

**Function name:** ``ExtensionDetails``

**Runtime:** Node.js 6.10


## Environment Variables

| Variable name: | Description:                           | Example:             |
| -------------- | -------------------------------------- | -------------------- |
| ``s3bucket``   | S3 bucket name for logging             | ``mybucket``         |
| ``region``     | Geographical region of Amazon DynamoDB | ``us-east-1``        |
| ``tablename``  | Amazon DynamoDB table name             | ``typo3_extensions`` |
| ``token``      | Security token (*)                     | ...                  |

\*) Request will be rejected, if security token do not match.


## Further Settings

**Memory:** 128 MB

**Timeout:** 10 seconds
