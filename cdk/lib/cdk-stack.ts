import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { readFileSync } from 'fs';

export class CdkStack extends cdk.Stack {

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
      'allow HTTP traffic from anywhere',
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
  };
}