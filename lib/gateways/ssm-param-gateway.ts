import * as log from 'lambda-log';
import * as ssm from '@aws-sdk/client-ssm';
import * as retryMiddleware from '@aws-sdk/middleware-retry'
import { Provider } from '@aws-sdk/types';

const SSM_RETRY_ATTEMPTS = 'SSM_RETRY_ATTEMPTS';
const SSM_RETRY_ATTEMPTS_DEFAULT = 10;
export class SsmGateway {

    ssmClient: ssm.SSMClient;

    constructor(ssmClient?: ssm.SSMClient) {

        if (!ssmClient) {

            const retryAttemptsEnv = process.env[SSM_RETRY_ATTEMPTS]

            const retryAttempts = (retryAttemptsEnv) ? parseInt(retryAttemptsEnv) : SSM_RETRY_ATTEMPTS_DEFAULT;
            const maxAttemptsProvider: Provider<number> = () => Promise.resolve(retryAttempts);

            const adaptiveRetry = new retryMiddleware.AdaptiveRetryStrategy(maxAttemptsProvider, {
            });
            this.ssmClient = new ssm.SSMClient({
                retryStrategy: adaptiveRetry,
            })
        }
        if (process.env.LOG_LEVEL && process.env.LOG_LEVEL.toLocaleLowerCase() === 'debug') {
            log.options.debug = true;
        }
    }

    public async putParameter(name: string, value: string): Promise<void> {
        log.debug(`api: aws ssm put-parameter`, { name, value })

        let result: ssm.PutParameterCommandOutput;
        try {

            result = await this.ssmClient.send(
                new ssm.PutParameterCommand({
                    Name: `${name}`,
                    Value: `${value}`,
                    Overwrite: true,
                    Type: ssm.ParameterType.STRING,
                })
            )

            if (!result.Version) throw Error(`Failed Updating parameter: ${value}`);
            log.debug(`Put Parameter Success`, {
                Version: result.Version,
            })
            return;

        } catch (error) {
            log.error("Unexpected error updating SSM Parameter", {
                error
            })
            throw error
        }
    }

    /**
     * 
     * @returns a list of ssmParameters, if nothing is found, an empty list is returned.
     */
    public async getParametersByPath(path: string): Promise<ssm.Parameter[]> {
        log.debug(`api: aws ssm get-parameters-by-path`, { path })

        let parameters: ssm.Parameter[] = [];
        try {

            const commandInput: ssm.GetParametersByPathCommandInput = {
                Path: path,
                Recursive: true,
            };

            const paginator = ssm.paginateGetParametersByPath({
                client: this.ssmClient,
            },
                commandInput);

            for await (const page of paginator){
                if(page.Parameters){
                    parameters.push(...page.Parameters);
                }
            }

            return parameters;

        } catch (error) {
            log.error("Unexpected error retrieving SSM Parameters", {
                error
            })
            throw error
        }
    }


    public async deleteParameter(name: string): Promise<void> {
        log.debug(`api: aws ssm delete-parameter`, { name })

        let result: ssm.DeleteParameterCommandOutput;
        try {

            result = await this.ssmClient.send(
                new ssm.DeleteParameterCommand({
                    Name: name
                })
            )

            if (!result) throw Error(`Failed Deleting parameter: ${name}`);
            return;

        } catch (error) {
            if (error instanceof ssm.ParameterNotFound) return;

            log.error("Unexpected error deleting SSM Parameter", {
                error
            })
            throw error
        }
    }


    public async deleteParameters(names: string[]): Promise<void> {
        log.debug(`api: aws ssm delete-parameters`, { names })

        let result: ssm.DeleteParametersCommandOutput;
        try {

            result = await this.ssmClient.send(
                new ssm.DeleteParametersCommand({
                    Names: names
                })
            )

            if (!result) {
                log.error("Failed Deleting Parameters", { result: result })
                throw Error(`Failed Deleting parameters: ${names}`);
            }

            if (result.DeletedParameters?.length !== names.length) {
                log.error("Failed to delete parameters: ", {
                    invalidParameters: result.InvalidParameters,
                })
                throw Error("Failed to delete some parameters.")
            }
            return;

        } catch (error) {
            log.error("Unexpected error deleting SSM Parameters", {
                error
            })
            throw error
        }
    }
}
