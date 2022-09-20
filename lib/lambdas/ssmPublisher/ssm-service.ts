import { Parameter } from '@aws-sdk/client-ssm';
import * as log from 'lambda-log';
import { Config, ConfigGroup, Configs } from '../..';
import { SsmGateway } from './ssm-param-gateway';

export class SsmService {
    ssmGateway: SsmGateway;

    public constructor(ssmGateway?: SsmGateway) {
        this.ssmGateway = ssmGateway || new SsmGateway();
        log.debug("Ssm Service Created")
    }

    public async updateParameters(configGroups: ConfigGroup[]) {

        log.debug("SsmService: updating parameters ")
        const existingParams: Parameter[] = await this.getExistingParametersForPaths(configGroups);
        log.debug("Found existing params", {params: existingParams})
        await this.ensureParametersExist(configGroups, existingParams);

        const orphanedParameters = this.getParametersToDelete(configGroups, existingParams);
        log.debug("Deleting Orphaned Parameters", { orphanedParameters: orphanedParameters });
        // await this.batchDeleteParameters(orphanedParameters);

        for (const param of orphanedParameters) {
            if(!param.Name) continue;
            await this.ssmGateway.deleteParameter(param.Name)
        }
    }

    /**
     * Deletes all parameters from SSM
     */
    public async deleteParameters(configGroups: ConfigGroup[]) {
        const configs = this.getAllConfigsForConfigGroups(configGroups);
        const params: Parameter[] = configs.map(x => {
            const param: Parameter = {
                Name: x.key,
                Value: x.value,
            }
            return param;
        })

        for (const param of params) {
            if(!param.Name) continue;
            await this.ssmGateway.deleteParameter(param.Name);
        }
        // await this.batchDeleteParameters(params);
    }

    getAllConfigsForConfigGroups(configGroups: ConfigGroup[]): Configs {
       const allConfigs: Configs = []
       configGroups.forEach(group => {
        allConfigs.push(...group.configSetArray);
       })
       return allConfigs;
    }
    /**
     * slices an array 5 at a time, deleting parameters in batch.
     * BROKEN
     */
    async batchDeleteParameters(parameters: Parameter[]) {
        const paramsToDelete = parameters;
        while (paramsToDelete.length) {
            const batch = paramsToDelete.slice(0, 5);
            const batchNames: string[] = [];

            batch.forEach(x => {
                if (x.Name) batchNames.push(x.Name);
            });

            await this.ssmGateway.deleteParameters(batchNames);
        }
    }

    /**
     * Finds parameters that exist in ssm but are not represented in the configuration, at this config root level.
     */
    getParametersToDelete(configGroups: ConfigGroup[], existingParams: Parameter[]) {
        const orphanedParameters: Parameter[] = []
        existingParams.forEach(param => {
            const found = this.configGroupContainsKey(configGroups, param.Name);
            if (!found) orphanedParameters.push(param);
        })
        log.debug("Found orphaned Parameters", { 
            orphanedParameters: orphanedParameters,
        })
        return orphanedParameters;
    }
    /**
     *  Determines if a parameter is not represented in the current config set.
     */
    configGroupContainsKey(configGroups: ConfigGroup[], key: string | undefined): boolean {
        let result: boolean = false;
        configGroups.forEach(group => {
            const found = group.configSetArray.find(x => x.key === key);
            if (found) result = true;
        })

        return result;
    }

    /**
     * 
     * @param configGroups 
     * @param existingParams 
     */
    async ensureParametersExist(configGroups: ConfigGroup[], existingParams: Parameter[]): Promise<void> {

        for (const group of configGroups) {
            for (const config of group.configSetArray) {
                const updateRequired = this.updateRequired(config, existingParams);
                if (updateRequired) {
                    await this.ssmGateway.putParameter(config.key, config.value);
                }else {
                    log.debug("No Update required", { config })
                }
            }
        }
    }
    /**
     * Determines if the parameter is absent or requires an update.
     */
    updateRequired(config: Config, existingParams: Parameter[]): boolean {
        const found = existingParams.find(x => {
            return (x.Name === config.key && x.Value === config.value)
        });
        return !found;
    }

    /**
     * uses all the paths in the config groups to get the list of existing parameters to work with
     * @returns 
     */
    private async getExistingParametersForPaths(configGroups: ConfigGroup[]) {
        const existingParams: Parameter[] = [];

        for (const group of configGroups) {
            const parameters = await this.ssmGateway.getParametersByPath(group.configGroupRoot);
            existingParams.push(...parameters);
        }
        return existingParams;
    }

}