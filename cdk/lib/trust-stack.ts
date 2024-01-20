import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';

export class TrustStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Github
    const githubOrg = new cdk.CfnParameter(this, 'GitHubOrg', {
      type: 'String',
      description: 'Github organization that owns the repository',
    });

    const githubProvider = new iam.CfnOIDCProvider(this, "git-hub-oid-provider", {
      thumbprintList: ["1b511abead59c6ce207077c0bf0e0043b1382612"],
      url: "https://token.actions.githubusercontent.com",
      clientIdList: ["sts.amazonaws.com"],
    });

    const githubActionRole = new iam.Role(this, 'github-actions-role', {
      assumedBy: new iam.FederatedPrincipal(
        githubProvider.attrArn,
        {
          StringLike: {
            // Specify that subscribers must be main branch of repository
            "token.actions.githubusercontent.com:sub": [
              `repo:${githubOrg.valueAsString}/matheusrosa-*:ref:refs/heads/main`,
            ]
          },
          StringEquals: {
            // Specify that auditor must be STS
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          }
        },
        "sts:AssumeRoleWithWebIdentity", // Allow the use the OIDC identiy#
      ),
    });

    const assumeCdkDeploymentRoles = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["sts:AssumeRole"],
      resources: ["arn:aws:iam::*:role/cdk-*"],
      conditions: {
        StringEquals: {
          "aws:ResourceTag/aws-cdk:bootstrap-role": [
            "file-publishing",
            "lookup",
            "deploy",
          ],
        }
      },
    });

    const assumeLambdaDeploymentRoles = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["lambda:UpdateFunctionCode"],
      resources: ["arn:aws:lambda:*:*:matheusrosa-*"],
    });

    const assumeAsgRefreshRoles = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["autoscaling:StartInstanceRefresh"],
      resources: ["*"]
    })

    githubActionRole.addToPolicy(assumeCdkDeploymentRoles);
    githubActionRole.addToPolicy(assumeLambdaDeploymentRoles);
    githubActionRole.addToPolicy(assumeAsgRefreshRoles);

    new cdk.CfnOutput(this, 'github-actions-role-arn', {
      value: githubActionRole.roleArn,
      description: 'The role ARN for GitHub Actions to use during deployment.',
    });
  };
}