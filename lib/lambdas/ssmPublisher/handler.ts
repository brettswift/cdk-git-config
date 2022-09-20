import * as lambda from 'aws-lambda';
import * as log from 'lambda-log';

/** Exports here are used by the cdk infrastructure */
export const SLEEP_SECONDS = 'SLEEP_SECONDS';

const PHYSICAL_ID = '6db73885-e1cf-4510-a926-31d058538016';
/**

/**
 * Entrypoint for the cloudformation custom resource.
 */
export async function handler(event: lambda.CloudFormationCustomResourceEvent): Promise<lambda.CloudFormationCustomResourceResponse> {

    log.options.debug = true;
    log.info('event', { event, envVars: process.env })

    const commonResponseValues: lambda.CloudFormationCustomResourceResponseCommon = {
        LogicalResourceId: event.LogicalResourceId,
        RequestId: event.RequestId,
        StackId: event.StackId,
        PhysicalResourceId: PHYSICAL_ID,
    }

    if (!event.RequestType) {
        const err = `event.RequestType not found. Did you mean to use the custom resource handler?`
        throw new Error(err);
    }

    if (!process.env[SLEEP_SECONDS]) throw Error("SLEEP_SECONDS parameter not found.")

    try {
        const sleepSec: number = parseInt(process.env[SLEEP_SECONDS])
        await sleep(sleepSec);

        log.info('Sleeping complete')
    } catch (error) {
        log.error('Sleep Timer Failed', { error })
        throw error;
    }

    return {
        ...commonResponseValues,
    } as lambda.CloudFormationCustomResourceSuccessResponse;

}

export async function sleep(maxWaitSeconds: number) {
    const sleepTime = Math.floor(Math.random() * 1000 * maxWaitSeconds);
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}
