#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import { ConfigExampleStack } from '../lib/config-example-stack';

const app = new cdk.App();
new ConfigExampleStack(app, 'ConfigExampleStack');
