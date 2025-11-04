#!/bin/bash -ex
ApiId=zjkf4upbbk # From the API Gateway.

curl -X POST \
  https://${ApiId}.execute-api.us-east-1.amazonaws.com/my-network \
  -H 'Content-Type: application/json'
