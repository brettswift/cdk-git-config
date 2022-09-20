import * as lambda from 'aws-lambda';
import * as log from 'lambda-log';
import { SsmGateway } from './ssm-param-gateway';

/** Exports here are used by the cdk infrastructure */
export const SLEEP_SECONDS = 'SLEEP_SECONDS';

// const PHYSICAL_ID = '6db73885-e1cf-4510-a926-31d058538016';
/**

/**
 * Entrypoint for the cloudformation custom resource.
 */
export async function handler(event: lambda.CloudFormationCustomResourceEvent): Promise<string> {

    log.options.debug = true;
    log.info('event', { event, envVars: process.env });

    if (!event.RequestType) {
        const err = `event.RequestType not found. Did you mean to use the custom resource handler?`
        throw new Error(err);
    }

    if (!process.env[SLEEP_SECONDS]) throw Error("SLEEP_SECONDS parameter not found.")

    try {
        // uncomment to spread out the load on SSM a little further.
        // const sleepSec: number = parseInt(process.env[SLEEP_SECONDS])
        // await sleep(sleepSec);

        const paramName = event.ResourceProperties['PARAM_NAME']
        const paramValue = event.ResourceProperties['PARAM_VALUE']
        console.log(event.ResourceProperties)

        if(!paramName) throw Error(`Expected to find env var PARAM_NAME but did not.`);
        if(!paramValue) throw Error(`Expected to find env var PARAM_VALUE but did not.`);

        const ssmGateway = new SsmGateway();

        switch (event.RequestType) {
            case 'Create':
            case 'Update':
                await ssmGateway.putParameter(paramName, paramValue);
                break;
            case 'Delete':
                await ssmGateway.deleteParameter(paramName);
                break;
            default:
                // RequestType is an implicitly typed string/enum and only has the 3 options above.
                throw Error(`Uh oh, we reached supposedly unreachable code when handling all known request types`)
        }

        log.info('Parameter Updated')
    } catch (error) {
        log.error('Param Update Failed', { error })
        throw error;
    }

    return "Successfully Created";
}

export async function sleep(maxWaitSeconds: number) {
    const sleepTime = Math.floor(Math.random() * 1000 * maxWaitSeconds);
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}
