#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WebserverStack } from '../lib/webserver-stack';
import { TrustStack } from '../lib/trust-stack';

const app = new cdk.App();

new TrustStack(app, 'TrustStack', {});
new WebserverStack(app, 'WebserverStack', {});
