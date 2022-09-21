import * as constructs from 'constructs';
// import { aws_ssm as ssm } from 'aws-cdk-lib';
import { custom_resources as cr } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { ConfigGroup } from '../config/types/config-types';
import { aws_logs as logs } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { aws_lambda_nodejs as nodeLambda } from 'aws-cdk-lib';
import * as path from 'path';
import { SLEEP_SECONDS } from '../lambdas/ssmPublisher/handler';
import { aws_iam as iam } from 'aws-cdk-lib';

export interface GitToSsmProps {
  configuration: ConfigGroup[];
  ssmRootPath: string;
}

export const CUSTOM_RESOURCE_TYPE = 'Custom::SsmParameterProvider';
/**
 * The lambda will wait a maximum of this time
 * (but randomly between 0 and this time).
 */
const MAX_INITIAL_SLEEP = 120;
const LAMBDA_TIMEOUT = 5;
export class GitToSsm extends constructs.Construct {

  constructor(readonly scope: constructs.Construct, readonly id: string, readonly props: GitToSsmProps) {
    super(scope, id);

    const runtime = lambda.Runtime.NODEJS_16_X;

    const uniqueString = Buffer.from(props.configuration.toString(), 'binary').toString('base64');

    const handler = new nodeLambda.NodejsFunction(this.scope, `${this.id}handler`, {
      runtime,
      // entry: path.join(__dirname, `../lambdas/ssmPublisher/individual-parameter-handler.ts`),
      entry: path.join(__dirname, `../lambdas/ssmPublisher/bulk-parameter-handler.ts`),
      handler: 'handler',
      depsLockFilePath: 'npm-shrinkwrap.json',
      timeout: cdk.Duration.seconds(LAMBDA_TIMEOUT),
      retryAttempts: 1,
      reservedConcurrentExecutions: 1,
      bundling: {
        banner: `/*Base64 Encoded config values: ${uniqueString} */`, // Important to keep - used to ensure a stack update.
        sourceMap: true,
        metafile: true,
        keepNames: true,
      },
      environment: {
        // TODO: remove, deprecated here.
        [SLEEP_SECONDS]: MAX_INITIAL_SLEEP.toString(),
      }
    });

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
    handler.addToRolePolicy(ssmPolicy);
    handler.role?.addToPrincipalPolicy(ssmPolicy);


    const ssmProvider = new cr.Provider(this, 'ssmProvider', {
      onEventHandler: handler,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });


    // this.createResourcePerParameter(props, ssmProvider);
    this.createResourcePerConfigTree(props, ssmProvider);
  }


  /**
   * Designed to be used with: bulk-parameter-handler.ts
   * 
   * The tree coming in will have one service and multiple namespaces - in their own config set.
   */
  private createResourcePerConfigTree(props: GitToSsmProps, ssmProvider: cr.Provider) {

    const configGroups = JSON.stringify(props.configuration);

    // console.log(JSON.stringify(configGroups, undefined, 2))
    // TODO: for testing, remove.
    // for (const configGroup of props.configuration) {
    //   console.log(`Root: ${configGroup.configGroupRoot} ConfigSetCount: ${configGroup.configSetArray.length}`)
    //   configGroup.configSetArray.forEach(x => {console.log(` .  ${x.key} --> ${x.value}`)})
    // }

    // TODO: is this key / id too big? 
    const encodedKey = Buffer.from(configGroups, 'binary').toString('base64');
    new cdk.CustomResource(this, `${encodedKey}CR`, {
      serviceToken: ssmProvider.serviceToken,
      resourceType: CUSTOM_RESOURCE_TYPE,
      properties: {
        CONFIG_GROUPS: `${configGroups}`,
      },
    });
  }

  /**
   * Designed to be used with: individual-parameter-handler.ts
   */
  public createResourcePerParameter(props: GitToSsmProps, ssmProvider: cr.Provider) {
    props.configuration.forEach(configGroup => {

      Object.keys(configGroup.configSets).forEach((key) => {

        const value = configGroup.configSets[key];

        const encodedKey = Buffer.from(key, 'binary').toString('base64');
        new cdk.CustomResource(this, `${encodedKey}CR`, {
          serviceToken: ssmProvider.serviceToken,
          resourceType: CUSTOM_RESOURCE_TYPE,
          properties: {
            PARAM_NAME: `${key}`,
            PARAM_VALUE: `${value}`,
          },
        });
      });
    });
  }
}
