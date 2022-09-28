#!/usr/bin/env node
import * as gitConfig from '../lib'
import * as log from 'lambda-log';
import path = require('path');
import * as cmdTs from 'cmd-ts';
import { StsGateway } from '../lib/gateways/sts-gateway';
import { SsmService } from '../lib/services/ssm-service';
import { exit } from 'process';

export function resolveSsmRootDirectory(namespace: string): string {
    if (namespace === 'live') {
        return '/dt-config';
    } else {
        return `/dev-config/${namespace}`
    }
}

export interface InputConfig {
    configPathDir: string;
    namespace: string;
}
export async function execute(props: InputConfig): Promise<void> {

    const ssmRootPath = resolveSsmRootDirectory(props.namespace);

    log.info(`SsmRootPath: ${ssmRootPath}`);

    // TODO: refactor config loader and this ssmGateway call
    // Config loader was used to separate this out into ConfigGroups for cloudformation.
    // However, the cloudformation approach has been abandoned, and this requires further refactoring.
    // Eventually this will become a step function event handler, and the CLI option may also disappear.
    const stsGateway = new StsGateway()
    const currentAccount = await (await stsGateway.getCallerIdentity()).Account

    const config = new gitConfig.ConfigLoader({
        rootDir: props.configPathDir,
        ssmRootPath,
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
    await updateAllConfigs(allConfigs, ssmRootPath);
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
        exit(1);
    }
})();
