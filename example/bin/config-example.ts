#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { ConfigExampleStack } from '../lib/config-example-stack';

const app = new cdk.App();
new ConfigExampleStack(app, 'ConfigExampleStack');
