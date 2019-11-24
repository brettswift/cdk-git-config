import cdk = require('@aws-cdk/core');
import ssm = require('@aws-cdk/aws-ssm')

import configParser = require('./config/configuration')

export interface GitToSsmProps {
  configuration: configParser.ConfigLoader
}

export class GitToSsm extends cdk.Construct {

  constructor(scope: cdk.Construct, id: string, props: GitToSsmProps) {
    super(scope, id);

    const allConfigs = props.configuration.load()

    allConfigs.forEach(configGroup => {
      
      Object.keys(configGroup.configSets).forEach((key)=> {

        const value = configGroup.configSets[key]

        new ssm.StringParameter(this, `Invoice-${configGroup.configGroupName}-${key}`, {
          description: `from file: ${configGroup.relativePath}`,
          parameterName: key,
          type: ssm.ParameterType.STRING,
          stringValue: `${value}`,
        })

    });
  })
}}
