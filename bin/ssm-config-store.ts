#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { SsmConfigStoreStack } from '../lib/ssm-config-store-stack';

const app = new cdk.App();
new SsmConfigStoreStack(app, 'SsmConfigStoreStack');
