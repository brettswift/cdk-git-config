import * as log from 'lambda-log';
import * as ssm from '@aws-sdk/client-ssm';
import * as retryMiddleware from '@aws-sdk/middleware-retry'
import { Provider } from '@aws-sdk/types';

export class SsmGateway {

    ssmClient: ssm.SSMClient;

    constructor(ssmClient?: ssm.SSMClient) {
        
        if (!ssmClient) {

            const maxAttemptsProvider: Provider<number> = () => Promise.resolve(10);

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
        log.debug(`api: aws ssm put-parameter`, {name, value})

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
            
            if(!result.Version) throw Error(`Failed Updating parameter: ${value}`);
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
        log.debug(`api: aws ssm get-parameters-by-path`, {path})

        let result: ssm.GetParametersByPathCommandOutput;
        try {
           
            result = await this.ssmClient.send(
                new ssm.GetParametersByPathCommand({ 
                    Path: path,
                })
            )
            
            if(!result) throw Error(`Failed retrieving parameters by path: ${path}`);

            if(result.NextToken) throw Error("paging is not implemented but is now required");

            return result.Parameters || []; 
        } catch (error) {
            log.error("Unexpected error retrieving SSM Parameters", { 
                error
             })
            throw error
        }
    }


    public async deleteParameter(name: string): Promise<void> {
        log.debug(`api: aws ssm delete-parameter`, {name})

        let result: ssm.DeleteParameterCommandOutput;
        try {

            result = await this.ssmClient.send(
                new ssm.DeleteParameterCommand({ 
                    Name: name
                })
            )
            
            if(!result) throw Error(`Failed Deleting parameter: ${name}`);
            return;

        } catch (error) {
            if(error instanceof ssm.ParameterNotFound) return;

            log.error("Unexpected error deleting SSM Parameter", { 
                error
             })
            throw error
        }
    }


    public async deleteParameters(names: string[]): Promise<void> {
        log.debug(`api: aws ssm delete-parameters`, {names})

        let result: ssm.DeleteParametersCommandOutput;
        try {

            result = await this.ssmClient.send(
                new ssm.DeleteParametersCommand({ 
                    Names: names
                })
            )
            
            if(!result) throw Error(`Failed Deleting parameters: ${names}`);

            if(result.DeletedParameters?.length !== names.length){
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
