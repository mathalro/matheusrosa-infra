import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { aws_elasticloadbalancingv2_targets as elasticloadbalancingv2_targets } from 'aws-cdk-lib';

import { ARecord, CnameRecord, PublicHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { readFileSync } from 'fs';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';

export class WebserverStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dns = 'matheusrosa.com';

    // VPC
    const vpc = new ec2.Vpc(this, 'website-vpc', {
      cidr: '192.168.0.0/16',
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'public',
          cidrMask: 24,
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ]
    });

    // Security Group
    const sg = new ec2.SecurityGroup(this, 'website-sg', {
      vpc,
      allowAllOutbound: true,
    });

    sg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'allow SSH access from anywhere',
    );

    sg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'allow HTTP traffic from anywhere',
    );

    sg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'allow HTTPS traffic from anywhere',
    );

    // Role for EC2 instance
    const instanceRole = new iam.Role(this, 'website-role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
      ],
    });

    // EC2 instance
    const ec2Instance = new ec2.Instance(this, 'ec2-instance', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      role: instanceRole,
      securityGroup: sg,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO,
      ),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      keyName: 'ec2-key-pair',
    });

    // User data
    const userDataScript = readFileSync('./lib/user-data.sh', 'utf-8');
    ec2Instance.addUserData(userDataScript);

    // Elastic IP
    const eip = new ec2.CfnEIP(this, 'ip', {
      instanceId: ec2Instance.instanceId
    });

    // DNS
    const publicHostedZone = new PublicHostedZone(this, 'public-hosted-zone', {
      zoneName: dns,
    });
    
    // Certificate
    const certificate = new acm.Certificate(this, 'certificate', {
      domainName: dns,
      validation: acm.CertificateValidation.fromDns(publicHostedZone),
    });
    
    // Load Balancer
    const lbSg = new ec2.SecurityGroup(this, 'lb-sg', {
      vpc,
      allowAllOutbound: true,
    });

    lbSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'allow SSH access from anywhere',
    );

    lbSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'allow HTTP traffic from anywhere',
    );

    lbSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'allow HTTPS traffic from anywhere',
    );

    const lb = new elb.ApplicationLoadBalancer(this, 'load-balancer', {
      vpc,
      internetFacing: true,
      securityGroup: lbSg 
    });

    const listener = lb.addListener('listener', {
      port: 443,
      open: true
    });
    
    // Listener
    const instanceTarget = new elasticloadbalancingv2_targets.InstanceTarget(ec2Instance);
    
    listener.addTargets('application-fleet', {
      port: 80,
      targets: [instanceTarget] 
    });

    listener.addCertificates('listener-certificate', [certificate]);
    const domain = new ARecord(this, 'domain', {
      zone: publicHostedZone,
      target: RecordTarget.fromAlias(new LoadBalancerTarget(lb)),
      ttl: cdk.Duration.minutes(5)
    });

    const wwwdomain = new CnameRecord(this, 'www-domain', {
      recordName: 'www',
      zone: publicHostedZone,
      domainName: dns,
      ttl: cdk.Duration.minutes(5)
    });

    // Create an articles ddb table
    const table = new cdk.aws_dynamodb.Table(this, 'articles-table', {
      billingMode: cdk.aws_dynamodb.BillingMode.PROVISIONED,
      tableName: 'articles',
      partitionKey: {
        name: 'userId',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: cdk.aws_dynamodb.AttributeType.NUMBER,
      },
      readCapacity: 1,
      writeCapacity: 1,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Create an users ddb table
    const usersTable = new cdk.aws_dynamodb.Table(this, 'users-table', {
      billingMode: cdk.aws_dynamodb.BillingMode.PROVISIONED,
      tableName: 'users',
      partitionKey: {
        name: 'userId',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      readCapacity: 1,
      writeCapacity: 1,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Define an empty Lambda function
    const lambdaApi = new lambda.Function(this, 'lambda-api', {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`exports.handler = async function(event:any) { return "Hello, CDK!"; }`),
      functionName: 'matheusrosa-application'
    });

    // Create the private API Gateway
    const api = new apigateway.RestApi(this, 'api-gateway', {
      restApiName: 'matheusrosa-api',
      description: 'Private API Gateway for the matheusrosa.com website.'
    });

    // Integrate with lambda
    const integration = new apigateway.LambdaIntegration(lambdaApi, {
      requestTemplates: {
        'application/json': '{ "statusCode": "200" }'
      }
    });

    table.grantReadWriteData(lambdaApi);
    usersTable.grantReadWriteData(lambdaApi);

    const articleResource = api.root.addResource('articles');
    articleResource.addMethod('GET', integration);
    articleResource.addMethod('POST', integration);

    const userResource = api.root.addResource('users');
    userResource.addMethod('POST', integration);
    userResource.addMethod('GET', integration);
  };
}