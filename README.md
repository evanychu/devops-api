# DevOps API

## Purpose
Use AWS Serverless Application Model (SAM) to create an API Gateway and a Lambda to perform DevOps operations.

This project demonstrates the use of SAM Command Line Interface to:
1. Create the scaffolding for an API Gateway that is connected to a Lambda function.
1. Create the infrastructure-as-code (CloudFormation) to deploy the API, Lambda and IAM role.
1. List, delete and create security group rules using AWS SDK for JavaScript in the Lambda.
1. Perform the deployment using SAM CLI.

## Update Security Group Rules
When a computer within a home network needs to access an EC2 instance for development purpose, the EC2 instance needs to allow ingress traffic from the home network. This permission is controlled by the EC2 instance's security group rules.

The computer in the home network calls the following HTTP API to update the security group's rules:

```
ApiId=abcd1234 # API ID from API Gateway.

curl -X POST \
  https://${ApiId}.execute-api.us-east-1.amazonaws.com/my-network \
  -H 'Content-Type: application/json'
```

The API's **my-network** route is connected to the Lambda function that:
1. Extract the source IP address of the the caller.
1. Calculate the network address of the caller.
1. Delete the existing security group rules associated with the EC2 instance.
1. Create new security group rules that allow ingress traffic from the caller's network to the EC2 instance.
