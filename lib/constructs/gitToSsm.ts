import * as constructs from 'constructs';
// import { aws_ssm as ssm } from 'aws-cdk-lib';
import { custom_resources as cr } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { ConfigGroup } from '../config/types/config-types';
import { aws_logs as logs } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { aws_lambda_nodejs as nodeLambda } from 'aws-cdk-lib';
import * as path from 'path';
import { aws_iam as iam } from 'aws-cdk-lib';
import { CONFIG_GROUPS, MAX_SLEEP_SECONDS } from '../lambdas/ssmPublisher/bulk-parameter-handler';

export interface GitToSsmProps {
  configuration: ConfigGroup[];
  ssmRootPath: string;
  /**
   * Default 5 min (300);
   */
  lambdaTimeoutDuration?: cdk.Duration;
  lambdaMaxSleepSeconds?: number;
}

export const CUSTOM_RESOURCE_TYPE = 'Custom::SsmParameterProvider';
/**
 * The lambda will wait a maximum of this time
 * (but randomly between 0 and this time).
 */
const MAX_INITIAL_SLEEP_SEC = 90; // can be changed in the lambda console of the provider.
// This timeout should be greater than the max Sleep + retry limit.
const LAMBDA_TIMEOUT_SEC = 5 * 60; 
export class GitToSsm extends constructs.Construct {
  
  constructor(readonly scope: constructs.Construct, readonly id: string, readonly props: GitToSsmProps) {
    super(scope, id);

    const runtime = lambda.Runtime.NODEJS_16_X;

    const lambdaTimeoutDuration = props.lambdaTimeoutDuration || cdk.Duration.seconds(LAMBDA_TIMEOUT_SEC);
    const initialSleepSeconds = props.lambdaMaxSleepSeconds || MAX_INITIAL_SLEEP_SEC;

    const uniqueString = Buffer.from(props.configuration.toString(), 'binary').toString('base64');

    const createHandler = new nodeLambda.NodejsFunction(this.scope, `${this.id}handler`, {
      runtime,
      // entry: path.join(__dirname, `../lambdas/ssmPublisher/individual-parameter-handler.ts`),
      entry: path.join(__dirname, `../lambdas/ssmPublisher/bulk-parameter-handler.ts`),
      handler: 'handler',
      depsLockFilePath: 'npm-shrinkwrap.json',
      timeout: lambdaTimeoutDuration,
      retryAttempts: 1,
      reservedConcurrentExecutions: 1,
      bundling: {
        banner: `/*Base64 Encoded config values: ${uniqueString} */`, // Important to keep - used to ensure a stack update.
        sourceMap: true,
        metafile: true,
        keepNames: true,
      },
      environment: {
        [MAX_SLEEP_SECONDS]: initialSleepSeconds.toString(),
      }
    });

    // Safeguard. Some consumers are type casting props.
    if (!props.ssmRootPath) throw Error("Ssm Root Path can not be undefined")

    const ssmPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:*'],
      resources: [
        `*`,
        // TODO:uncomment and test 
        // `arn:aws:ssm:${cdk.Stack.of(this).region}::parameter${props.ssmRootPath}`,
        // `arn:aws:ssm:${cdk.Stack.of(this).region}::parameter${props.ssmRootPath}/*`,
      ],
    });
    createHandler.addToRolePolicy(ssmPolicy);
    createHandler.role?.addToPrincipalPolicy(ssmPolicy);

    const createSsmProvider = new cr.Provider(this, 'createSsmProvider', {
      onEventHandler: createHandler,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    this.createUpdatingResourcePerConfigTree(props, createSsmProvider);
  }


  /**
   * Designed to be used with: bulk-parameter-handler.ts
   * 
   * The tree coming in will have one service and multiple namespaces - in their own config set.
   */
  private createUpdatingResourcePerConfigTree(props: GitToSsmProps, ssmProvider: cr.Provider) {

    const configGroups = JSON.stringify(props.configuration);

    new cdk.CustomResource(this, `EnsureParametersCR`, {
      serviceToken: ssmProvider.serviceToken,
      resourceType: CUSTOM_RESOURCE_TYPE,
      properties: {
        [CONFIG_GROUPS]: `${configGroups}`,
      },
    });
  }
}
