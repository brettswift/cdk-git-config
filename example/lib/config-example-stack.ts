import cdk = require('@aws-cdk/core');
import ssm = require('@aws-cdk/aws-ssm')

import configParser = require('../../lib/config/configuration')
import path = require('path')

export class ConfigExampleStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const relativeConfigPath = '../../config'
    const configRoot = path.resolve(__dirname + relativeConfigPath);

    const configLoader = new configParser.ConfigLoader({
      rootDir: configRoot,
      ssmRootPath: '/gitconfigstore/root'
    })

    const allConfigs = configLoader.load()
    configLoader.printConfiguration()

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
  }
}
