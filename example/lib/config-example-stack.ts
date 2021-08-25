import cdk = require('@aws-cdk/core');

import configParser = require('../../lib/config/configuration')
import { splitGroupsAtPathDepth }  from '../../lib/config/config-splitter';

import gitToSsm = require('../../lib/constructs/gitToSsm')
import path = require('path')
import { ConfigGroup } from '../../lib/config/types/config-types';

const ssmRootPath = '/gitconfigstore/root';
export class ConfigExampleStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const relativeConfigPath = '../../config'
    const configRoot = path.resolve(__dirname + relativeConfigPath);

    const configLoader = new configParser.ConfigLoader({
      rootDir: configRoot,
      ssmRootPath: ssmRootPath,
      filterByCurrentAccount: false, //uncomment to see behavioural differences
    })

    // TODO: cleanup this implementation
    const configGroup: ConfigGroup[] = configLoader.load()
    configLoader.printConfiguration(configGroup)
 
    const splitGroups = splitGroupsAtPathDepth(configGroup, 1);
    console.log(splitGroups)

    splitGroups.forEach(group => {
      // To have a stack per group - instantiate that here.
      new gitToSsm.GitToSsm(this, `SampleConfig${group.filteredByPath}`, {
        configuration: group.groups,
        ssmRootPath, 
      })
    })
  }
}
