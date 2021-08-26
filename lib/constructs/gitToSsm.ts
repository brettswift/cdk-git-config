import cdk = require('@aws-cdk/core');
import ssm = require('@aws-cdk/aws-ssm')

import { ConfigGroup } from '../config/types/config-types';

export interface GitToSsmProps {
  configuration: ConfigGroup[];
  ssmRootPath: string;
}

export class GitToSsm extends cdk.Construct {

  constructor(scope: cdk.Construct, id: string, props: GitToSsmProps) {
    super(scope, id);

    props.configuration.forEach(configGroup => {
      
      Object.keys(configGroup.configSets).forEach((key)=> {

        const value = configGroup.configSets[key]

        new ssm.StringParameter(this, `${props.ssmRootPath}-${configGroup.configGroupName}-${key}`, {
          description: `from file: ${configGroup.relativePath}`,
          parameterName: key,
          type: ssm.ParameterType.STRING,
          stringValue: `${value}`,
        })

    });
  })
}}
