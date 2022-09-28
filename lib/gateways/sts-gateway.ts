import * as log from 'lambda-log';
import * as sts from '@aws-sdk/client-sts';
import * as retryMiddleware from '@aws-sdk/middleware-retry'
import { Provider } from '@aws-sdk/types';

const STS_RETRY_ATTEMPTS = 'STS_RETRY_ATTEMPTS';
const RETRY_ATTEMPTS_DEFAULT = 10;
export class StsGateway {

    stsClient: sts.STSClient;

    constructor(stsClient?: sts.STSClient) {

        if (!stsClient) {

            const retryAttemptsEnv = process.env[STS_RETRY_ATTEMPTS]
            const retryAttempts = (retryAttemptsEnv) ? parseInt(retryAttemptsEnv) : RETRY_ATTEMPTS_DEFAULT;
            const maxAttemptsProvider: Provider<number> = () => Promise.resolve(retryAttempts);

            const adaptiveRetry = new retryMiddleware.AdaptiveRetryStrategy(maxAttemptsProvider, {});
            this.stsClient = new sts.STSClient({
                retryStrategy: adaptiveRetry,
            })
        }
        if (process.env.LOG_LEVEL && process.env.LOG_LEVEL.toLocaleLowerCase() === 'debug') {
            log.options.debug = true;
        }
    }

    public async getCallerIdentity(): Promise<sts.GetCallerIdentityCommandOutput> {
        log.debug(`api: aws sts get-caller-identity`);

        let result: sts.GetCallerIdentityCommandOutput;
        try {

            result = await this.stsClient.send(
                new sts.GetCallerIdentityCommand({})
            )
            return result;

        } catch (error) {
            log.error("Unexpected error getting caller identity.", {
                error
            })
            throw error
        }
    }
}