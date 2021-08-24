import cdk = require('@aws-cdk/core');

import configParser = require('../../lib/config/configuration')
import gitToSsm = require('../../lib/gitToSsm')
import path = require('path')

export class ConfigExampleStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const relativeConfigPath = '../../config'
    const configRoot = path.resolve(__dirname + relativeConfigPath);

    const configLoader = new configParser.ConfigLoader({
      rootDir: configRoot,
      ssmRootPath: '/gitconfigstore/root',
      // filterByCurrentAccount: false, //uncomment to see behavioural differences
    })

    // TODO: cleanup this implementation
    configLoader.load()
    configLoader.printConfiguration()

    new gitToSsm.GitToSsm(this, 'SampleConfig', {
      configuration: configLoader
    })
  }
}
