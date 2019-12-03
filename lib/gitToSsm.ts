import cdk = require('@aws-cdk/core');
import ssm = require('@aws-cdk/aws-ssm')
import configParser = require('./config/configuration')

import STS = require('aws-sdk/clients/sts')

export interface GitToSsmProps {
  configuration: configParser.ConfigLoader
  /**
   * Looks for a pattern in the root config of /account/<account_number. 
   * Enabling this feature will ignore any configs outside of the current account.
   */
  onlyCurrentAccount?: boolean
}

export class GitToSsm extends cdk.Construct {

  private onlyCurrentAccount: boolean
  constructor(scope: cdk.Construct, id: string, props: GitToSsmProps) {
    super(scope, id);

    this.onlyCurrentAccount = props.onlyCurrentAccount || false
    const sts = new STS()

    const result = sts.getCallerIdentity().promise()
    console.log(result)
    
    // const currentAccountId = sts
    const allConfigs = props.configuration.load()

    allConfigs.forEach(configGroup => {
      console.log(`${configGroup.configGroupName} ==? ${cdk.Stack.of(this).account}`)
      if(configGroup.configGroupName === `account/curracount`){

      }
      Object.keys(configGroup.configSets).forEach((key)=> {

        const value = configGroup.configSets[key]

      
        const param = new ssm.StringParameter(this, `${props.configuration.ssmRootPath}-${configGroup.configGroupName}-${key}`, {
          description: `from file: ${configGroup.relativePath}`,
          parameterName: key,
          type: ssm.ParameterType.STRING,
          stringValue: `${value}`,
        })
    });
  })

}}
