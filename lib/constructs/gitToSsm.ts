import * as constructs from 'constructs';
import { aws_ssm as ssm } from 'aws-cdk-lib';
import { custom_resources as cr } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { ConfigGroup } from '../config/types/config-types';
import { aws_logs as logs } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { aws_lambda_nodejs as nodeLambda } from 'aws-cdk-lib';
import * as path from 'path';
import { SLEEP_SECONDS } from '../lambdas/ssmPublisher/handler';

export interface GitToSsmProps {
  configuration: ConfigGroup[];
  ssmRootPath: string;
}

const CUSTOM_RESOURCE_TYPE = 'Custom::SsmParameterProvider';
/**
 * The lambda will wait a maximum of this time
 * (but randomly between 0 and this time).
 */
const MAX_INITIAL_SLEEP = 120;
export class GitToSsm extends constructs.Construct {

  constructor(readonly scope: constructs.Construct, readonly id: string, readonly props: GitToSsmProps) {
    super(scope, id);

    const runtime = lambda.Runtime.NODEJS_16_X;

    const uniqueString = Buffer.from(props.configuration.toString(), 'binary').toString('base64');

    const handler = new nodeLambda.NodejsFunction(this.scope, `${this.id}handler`, {
      runtime,
      entry: path.join(__dirname, `../lambdas/ssmPublisher/handler.js`),
      handler: 'handler',
      depsLockFilePath: 'npm-shrinkwrap.json',
      timeout: cdk.Duration.seconds(MAX_INITIAL_SLEEP + 30),
      bundling: {
        banner: `/*Base64 Encoded config values: ${uniqueString} */`, // Important to keep - used to ensure a stack update.
        sourceMap: true,
        metafile: true,
        keepNames: true,
      },
      environment: {
        [SLEEP_SECONDS]: MAX_INITIAL_SLEEP.toString(),
      }
    });

    const ssmProvider = new cr.Provider(this, 'SleepProvider', {
      onEventHandler: handler,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    const ssmSleeper = new cdk.CustomResource(this, 'SleepCR', {
      serviceToken: ssmProvider.serviceToken,
      resourceType: CUSTOM_RESOURCE_TYPE,
    });

    props.configuration.forEach(configGroup => {

      Object.keys(configGroup.configSets).forEach((key) => {

        const value = configGroup.configSets[key]

        const param = new ssm.StringParameter(this, `${props.ssmRootPath}-${configGroup.configGroupName}-${key}`, {
          description: `from file: ${configGroup.relativePath}`,
          parameterName: key,
          type: ssm.ParameterType.STRING,
          stringValue: `${value}`,
        })

        param.node.addDependency(ssmSleeper);
      });
    })
  }
}
