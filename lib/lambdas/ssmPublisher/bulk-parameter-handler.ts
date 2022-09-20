import * as lambda from 'aws-lambda';
import * as log from 'lambda-log';
import { ConfigGroup } from '../..';
import { SsmService } from './ssm-service';

/** Exports here are used by the cdk infrastructure */
export const MAX_SLEEP_SECONDS = 'SLEEP_SECONDS';
export const CONFIG_GROUPS = 'CONFIG_GROUPS;';

const PHYSICAL_RESOURCE_ID = '01900d9f-6d61-47a9-a3d3-b675f161b11b'
/**
 * Entrypoint for the cloudformation custom resource.
 */
export async function handler(event: lambda.CloudFormationCustomResourceEvent): Promise<lambda.CdkCustomResourceResponse> {

    log.options.debug = true;
    log.info('event', { event, envVars: process.env });

    if (!event.RequestType) {
        const err = `event.RequestType not found. Did you mean to use the custom resource handler?`
        throw new Error(err);
    }

    if (!process.env[MAX_SLEEP_SECONDS]) throw Error("SLEEP_SECONDS parameter not found.")

    try {

        const maxSleepSecString = process.env[MAX_SLEEP_SECONDS] || '1';
        const maxSleepSec: number = parseInt(maxSleepSecString)
        await sleep(maxSleepSec);

        const configs = event.ResourceProperties[CONFIG_GROUPS]
        // const deleteModeEnabled: boolean = Boolean(event.ResourceProperties[DELETE_MODE]);

        const configGroups: ConfigGroup[] = JSON.parse(configs)
        log.info('configGroups', {
            [CONFIG_GROUPS]: configGroups,
        })
        if (!configGroups) throw Error(`Expected to find resource Properties CONFIG_GROUPS but did not.`);

        const ssmService = new SsmService();

        switch (event.RequestType) {
            case 'Create':
            case 'Update':
                log.info("handling Create RequestType - for update parameters.")
                await ssmService.updateParameters(configGroups);
                log.info('Parameters Updated');
                return success();
            case 'Delete':
                log.info("handling Delete RequestType - for delete parameters.")
                await ssmService.deleteParameters(configGroups);
                log.info('Parameters Deleted');
                return success();
            default:
                // RequestType is an implicitly typed string/enum and only has the 3 options above.
                throw Error(`Uh oh, we reached supposedly unreachable code when handling all known request types`)
        }

    } catch (error) {
        log.error('Param Update Failed', { error })
        throw error;
    }
}

function success(): lambda.CdkCustomResourceResponse {
    const returnStatus = {
        PhysicalResourceId: PHYSICAL_RESOURCE_ID,
    }
    log.debug("returning", {returnStatus: returnStatus})
    return returnStatus
}

export async function sleep(maxWaitSeconds: number) {
    const sleepTime = Math.floor(Math.random() * 1000 * maxWaitSeconds);
    log.debug("Sleeping to spread out config deployments", {sleepingFor: sleepTime, maxSleepTime: maxWaitSeconds})
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}
