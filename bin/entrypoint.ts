#!/usr/bin/env node
import * as gitConfig from '../lib'
import * as log from 'lambda-log';
import path = require('path');
import * as cmdTs from 'cmd-ts';
import { StsGateway } from '../lib/gateways/sts-gateway';
import { SsmService } from '../lib/services/ssm-service';
import { ConfigService, CONFIG_DESTINATION_CONFIG_ROOT, DEFAULT_TARGET_NAMESPACE } from '../lib/services/config-service';

/**
 * Example configuration:
 *     /config-deploy-namespaces/default: /dev-config/
 *     /config-deploy-namespaces/live: /dt-config/v1
 *     /config-deploy-namespaces/pre: /dtops-config/v1
 * 
 *  When using the default configuration, by not supplying a namespace configuration, the config 
 *  root will be placed at <default>/<namespace>.   For example in the config above, with a namespace 
 *  of donkey, the config root will be: 
 *     /dev-config/donkey
 * @param namespace 
 * @returns 
 */
export async function resolveSsmRootDirectory(namespace: string): Promise<string> {

    const configService = new ConfigService();

    const configs = await configService.getSsmTargetPathConfiguration();

    const configNamespaceTarget = configs.find((x) => x.namespace === namespace);
    const configDefaultTarget = configs.find((x) => x.namespace === DEFAULT_TARGET_NAMESPACE)

    const message = `FAILURE: Neither namespace or ${DEFAULT_TARGET_NAMESPACE} were defined at:  ${CONFIG_DESTINATION_CONFIG_ROOT} `
    if (!(configNamespaceTarget || configDefaultTarget)) {
        log.error(message);
        throw Error(message);
    }

    console.debug(`Found Config: default: ${configDefaultTarget?.targetConfigRoot} - namespace - ${JSON.stringify(configNamespaceTarget)}`)
    
    return configNamespaceTarget?.targetConfigRoot || `${configDefaultTarget?.targetConfigRoot}`;
}

/**
 * namespace to target ssm path configuration
 */
export type InputConfig = {
    configPathDir: string;
    namespace: string;
}

export async function execute(props: InputConfig): Promise<void> {

    const targetSsmRootPath = await resolveSsmRootDirectory(props.namespace);
    console.debug(`Using Target for SSM Deployments: ${targetSsmRootPath}`)

    if(!targetSsmRootPath) return;
    log.info(`SsmRootPath: ${targetSsmRootPath}`);

    // TODO: refactor config loader and this ssmGateway call
    // Config loader was used to separate this out into ConfigGroups for cloudformation.
    // However, the cloudformation approach has been abandoned, and this requires further refactoring.
    // Eventually this will become a step function event handler, and the CLI option may also disappear.
    const stsGateway = new StsGateway()
    const currentAccount = await (await stsGateway.getCallerIdentity()).Account

    const config = new gitConfig.ConfigLoader({
        rootDir: props.configPathDir,
        ssmRootPath: targetSsmRootPath,
        currentAccount,
    })

    log.info("loading config groups")
    const allGroups = config.load();

    // Get all configs in one flat array, ignoring config groups.
    const allConfigs = allGroups.flatMap(group => {
        return group.configSetArray;
    })
    log.info(`Incoming Config Set Count: ${allConfigs.length}`)
    log.info("Starting update of parameters");
    await updateAllConfigs(allConfigs, targetSsmRootPath);
}

export async function updateAllConfigs(allConfigs: gitConfig.Config[], ssmRootPath: string) {
    const ssmService = new SsmService();

    const result = await ssmService.updateParametersByConfigRoot(allConfigs, ssmRootPath)

    log.info("Update Result", {
        result: result
    })

}

// needs a tsconfig change that might not work for cdk, for now use top level promise.
// await execute({
//     configPathDir: '/Users/bswift/src/aws/cdk-apps/automation/config-automation/shaw-aws-configuration-nonprod/config/v1',
//     namespace: 'bswift',
// })
// await run() {

// }
log.options.debug = true;
(async () => {
    try {

        const cwd = path.join(__dirname);
        log.info(`running in: ${cwd}`)

        const configDirOption = cmdTs.option({
            type: cmdTs.string,
            long: 'configDir',
            short: 'c',
        });

        const namespaceOption = cmdTs.option({
            type: cmdTs.string,
            long: 'namespace',
            short: 'n',
        });

        const cmd = cmdTs.command({
            name: 'Config Deployer',
            args: {
                namespace: namespaceOption,
                configDir: configDirOption,
            },
            handler: async (args) => {
                const config: InputConfig = {
                    namespace: args.namespace,
                    configPathDir: args.configDir,
                }
                await execute(config);
            }
        });

        //start handling args
        await cmdTs.run(cmd, process.argv.slice(2))

        log.info("Complete.  Exiting");

    } catch (e) {
        // Deal with the fact the chain failed
        log.info("error", { error: e });
        process.exit(1);
    }
})();
