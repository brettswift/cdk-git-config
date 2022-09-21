import * as log from 'lambda-log';
import * as ssm from '@aws-sdk/client-ssm';
import * as retryMiddleware from '@aws-sdk/middleware-retry'
import { Provider } from '@aws-sdk/types';

export class SsmGateway {

    ssmClient: ssm.SSMClient;

    constructor(ssmClient?: ssm.SSMClient) {
        
        if (!ssmClient) {

            // const MAXIMUM_RETRY_DELAY = 20 * 1000;

            const maxAttemptsProvider: Provider<number> = () => Promise.resolve(10);
            // const delayDecider = (delayBase: number, attempts: number) =>{
            //     Math.floor(
            //         Math.min(MAXIMUM_RETRY_DELAY, Math.random() * 2 ** attempts * delayBase)
            //     );
            // }

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
            return;

        } catch (error) {
            log.error("Unexpected error deleting SSM Parameters", { 
                error
             })
            throw error
        }
    }
}
