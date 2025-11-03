import { EC2Client, DescribeSecurityGroupRulesCommand, RevokeSecurityGroupIngressCommand, AuthorizeSecurityGroupIngressCommand } from "@aws-sdk/client-ec2";

console.log('Loading function');
const ec2 = new EC2Client({ region: process.env.AWS_REGION });

/**
 * Convert IP address to CIDR notation like x.y.0.0/16.
 * @param {string} ip IP address.
 * @returns {string} CIDR notation of the IP address.
 */
function convertIpToCidr(ip) {
  const parts = ip.split('.');
  const cidr = parts[0] + '.' + parts[1] + '.0.0/16';
  return cidr;
}

/**
 * Get return response object.
 * @param {number} statusCode HTTP status code.
 * @param {Object} bodyObject Any JSON object.
 * @returns {string} compatible with API Gateway.
 */
function getReturnReponse(statusCode, bodyObject) {
  const response = {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObject)
  }
  return response;
}

/**
 * Replace security-group rules to allow ingress from an allowed network.
 * @param {Object} ingressRules The filtered output of DescribeSecurityGroupRulesCommand() looks like:
 *   [
 *       {
 *           "SecurityGroupRuleId": "sgr-09d97d4b07fbec356",
 *           "GroupId": "sg-022fac8c05bdd5df0",
 *           "GroupOwnerId": "992887713340",
 *           "IsEgress": false,
 *           "IpProtocol": "tcp",
 *           "FromPort": 22,
 *           "ToPort": 22,
 *           "CidrIpv4": "1.2.3.4/32",
 *           "Description": "text",
 *           "Tags": [],
 *           "SecurityGroupRuleArn": "arn:aws:ec2:us-east-1:992887713340:security-group-rule/sgr-09d97d4b07fbec356"
 *       },
 *       ...
 *   ]
 * @param allowedNetworkCidr The network CIDR notation.
 * @returns void
 */
async function replaceRules(ingressRules, allowedNetworkCidr) {
  console.log('replaceRules: enter');
  let command, response, input;

  // Delete existing rules.
  input = {
    GroupId: ingressRules[0].GroupId,
    IpPermissions: ingressRules.map((x) => {
      return { IpProtocol: x.IpProtocol, FromPort: x.FromPort, ToPort: x.ToPort, IpRanges: [{ CidrIp: x.CidrIpv4 }] };
    })
  };
  console.log(`replaceRules: revoke input=${JSON.stringify(input, null, 2)}`);
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ec2/command/RevokeSecurityGroupIngressCommand/
  command = new RevokeSecurityGroupIngressCommand(input);
  response = await ec2.send(command);
  if (!response.Return) {
    throw new Error(`replaceRules: Revoke error; response=${JSON.stringify(response)}`);
  }

  // Add new rules that allow ingress from the allowed network.
  input = {
    GroupId: ingressRules[0].GroupId,
    IpPermissions: ingressRules.map((x) => {
      return { IpProtocol: x.IpProtocol, FromPort: x.FromPort, ToPort: x.ToPort, IpRanges: [{ CidrIp: allowedNetworkCidr, Description: "Allowed network" }] };
    })
  };
  console.log(`replaceRules: authorize input=${JSON.stringify(input, null, 2)}`);
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ec2/command/AuthorizeSecurityGroupIngressCommand/
  command = new AuthorizeSecurityGroupIngressCommand(input);
  response = await ec2.send(command);
  if (!response.Return) {
    throw new Error(`replaceRules: Authorize error; response=${JSON.stringify(response)}`);
  }
  console.log('replaceRules: exit');
}

/**
 * Expect API Gateway to call this entry point.
 */
export const lambdaHandler = async (event, context) => {
  console.log('lambdaHandler: enter ==========', JSON.stringify(event, null, 2));
  const sourceIp = event['requestContext']['http']['sourceIp'];
  const allowedNetwork = convertIpToCidr(sourceIp);
  const securityGroupId = process.env.TARGET_SECURITY_GROUP_ID;
  console.log(`lambdaHandler: securityGroupId=${securityGroupId}; sourceIp=${sourceIp}; allowed network=${allowedNetwork}`);

  const input = {
    Filters: [
      {
        Name: 'group-id',
        Values: [securityGroupId]
      }
    ]
  };

  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ec2/command/DescribeSecurityGroupRulesCommand/
  const command = new DescribeSecurityGroupRulesCommand(input);
  const response = await ec2.send(command);
  const rules = response.SecurityGroupRules;
  if (response.SecurityGroupRules?.length === 0) {
    const message = `lambdaHandler: No rules found for security group ${securityGroupId}`;
    return getReturnReponse(200, { message });
  }

  const ingressRules = rules.filter(rule => (rule.IsEgress === false) && rule.CidrIpv4 && (rule.IpProtocol === 'tcp') && rule.FromPort && rule.ToPort);
  console.log(`lambdaHandler: target rules=${JSON.stringify(ingressRules, null, 2)}`);
  if (ingressRules.length > 0) {
    await replaceRules(ingressRules, allowedNetwork);
  } else {
    const message = `lambdaHandler: No ingress rules found for security group ${securityGroupId}`;
    return getReturnReponse(200, { message });
  }
  return getReturnReponse(200, { message: 'OK' });
};
