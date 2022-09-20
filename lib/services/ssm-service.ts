import { Parameter } from '@aws-sdk/client-ssm';
import * as log from 'lambda-log';
import { Config, ConfigGroup, Configs } from '..';
import { SsmGateway } from '../gateways/ssm-param-gateway';
import { StsGateway } from '../gateways/sts-gateway';

export interface UpdateResult {
    updated: number;
    deleted: number;
    untouched: number;
}
export class SsmService {
    ssmGateway: SsmGateway;
    stsGateway: StsGateway;

    currentAccount: string;
    public constructor(ssmGateway?: SsmGateway, stsGateway?: StsGateway) {
        this.ssmGateway = ssmGateway || new SsmGateway();
        this.stsGateway = stsGateway || new StsGateway();
        log.debug("Ssm Service Created")
    }

    public async updateParameters(configGroups: ConfigGroup[]) {

        log.debug("SsmService: updating parameters ")
        const existingParams: Parameter[] = await this.getExistingParametersForConfigGroups(configGroups);
        log.debug("Found existing params", {
            numberOfParams: existingParams.length,
            // params: existingParams,
        });

        await this.ensureConfigGroupsExist(configGroups, existingParams);
        const orphanedParameters = this.getParametersToDelete(configGroups, existingParams);
        log.debug("Deleting Orphaned Parameters", { orphanedParameters: orphanedParameters });
        // await this.batchDeleteParameters(orphanedParameters);

        for (const param of orphanedParameters) {
            if (!param.Name) continue;
            await this.ssmGateway.deleteParameter(param.Name)
        }

    }

    /**
     * Operates at a single config root level only.
     * Queries all parameters in that config root and: 
     *  1. updates any parameters with differences
     *  2. deletes any parameters not in the config array.
     */
    public async updateParametersByConfigRoot(configs: Config[], ssmRootPath: string): Promise<UpdateResult> {
        const existingParams = await this.ssmGateway.getParametersByPath(ssmRootPath);
        log.debug(`Found ${existingParams.length} parameters`)
        const { updated, untouched } = await this.ensureAllConfigsExist(configs, existingParams);

        const orphanedParameters = this.getParametersToDeleteByConfigs(configs, existingParams);
        const deleted = await this.batchDeleteParameters(orphanedParameters);

        // for (const param of orphanedParameters) {
        //     if (!param.Name) continue;
        //     await this.ssmGateway.deleteParameter(param.Name)
        // }

        return {
            deleted,
            updated,
            untouched,
        }
    }
    /**
    * Finds parameters that exist in ssm but are not represented in the configuration, at this config root level.
    */
    getParametersToDeleteByConfigs(configs: Config[], existingParams: Parameter[]): Parameter[] {
        const orphanedParameters: Parameter[] = []
        existingParams.forEach(param => {
            const found = this.configsContainParameterName(configs, param);
            if (!found) orphanedParameters.push(param);
        })
        log.debug("Found orphaned Parameters", {
            count: orphanedParameters.length,
        })
        return orphanedParameters;
    }

    /**
     * determines if a parameter is represented in the incoming config set.
     */
    private configsContainParameterName(configs: Config[], param: Parameter) {
        return configs.find(config => `${config.key}` === `${param.Name}`)
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
            if (!param.Name) continue;
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
     */
    async batchDeleteParameters(parameters: Parameter[]): Promise<number> {
        const paramsToDelete = parameters;
        const paramNames: string[] = []
        paramsToDelete.forEach(x => {
            if (x.Name) paramNames.push(x.Name);
        });

        return await this.batchDeleteParametersByName(paramNames);
    }

    /**
    * slices an array 5 at a time, deleting parameters in batch.
    */
    async batchDeleteParametersByName(parameterNames: string[]): Promise<number> {
        const paramsToDelete = parameterNames;
        const paramCount = paramsToDelete.length;
        while (paramsToDelete.length) {
            const batch = paramsToDelete.splice(0, 9);
            log.debug("Deleting batch of parameters", { batch: batch })
            await this.ssmGateway.deleteParameters(batch);
        }
        log.debug(`Deleted a total of ${paramCount} parameters.`);
        return paramCount;
    }

    /**
     * Finds parameters that exist in ssm but are not represented in the configuration, at this config root level.
     */
    getParametersToDelete(configGroups: ConfigGroup[], existingParams: Parameter[]) {
        const orphanedParameters: Parameter[] = []
        existingParams.forEach(param => {
            const found = this.configGroupsContainsKey(configGroups, param.Name);
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
    configGroupsContainsKey(configGroups: ConfigGroup[], key: string | undefined): boolean {
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
     * @returns the number of parameters updated
     */
    async ensureAllConfigsExist(allConfigs: Config[], existingParams: Parameter[]): Promise<{ updated: number; untouched: number; }> {
        let updateNotRequiredCount = 0;
        let parametersUpdated = 0;
        for (const config of allConfigs) {
            const updateRequired = this.updateRequired(config, existingParams);
            if (updateRequired) {
                const existingParam = existingParams.find(x => x.Name === config.key)
                log.debug("Update Required", {
                    key: config.key,
                    oldVal: existingParam, //omitted from logs if not found.
                    newVal: config.value,
                })
                await this.ssmGateway.putParameter(config.key, config.value);
                parametersUpdated += 1;

            } else {
                updateNotRequiredCount += 1;
            }
        }

        return {
            updated: parametersUpdated,
            untouched: updateNotRequiredCount,
        }
    }

    /**
     * 
     * @param configGroups 
     * @param existingParams 
     */
    async ensureConfigGroupsExist(configGroups: ConfigGroup[], existingParams: Parameter[]): Promise<void> {

        const allConfigs: Config[] = configGroups.flatMap(g => {
            return g.configSetArray;
        })

        this.ensureAllConfigsExist(allConfigs, existingParams);
    }

    updateRequired(config: Config, existingParams: Parameter[]): boolean {

        const found = existingParams.find(x => {
            return (`${x.Name}` === `${config.key}`)
        });

        if (!found) return true;

        if (`${config.value}` === `${found?.Value}`) return false;
        return true;
    }


    /**
     * uses all the paths in the config groups to get the list of existing parameters to work with
     * @returns 
     */
    private async getExistingParametersForConfigGroups(configGroups: ConfigGroup[]) {
        const existingParams: Parameter[] = [];

        let total = 0;

        for (const group of configGroups) {
            let configGroupRoot = await this.normalizeConfigGroupRootForAccounts(group);
            const parameters = await this.ssmGateway.getParametersByPath(configGroupRoot);
            existingParams.push(...parameters);
            total += parameters.length
        }
        log.info(`Accumulated ${total} Parameters`)
        return existingParams;
    }

    /**
     * In case this path includes the account number, we remove it from the root path.
     */
    private async normalizeConfigGroupRootForAccounts(group: ConfigGroup) {
        const currAccount = await this.getAccount();
        let configGroupRoot = group.configGroupRoot;
        if (group.configGroupRoot.includes(currAccount)) {
            configGroupRoot = group.configGroupRoot.replace(`/${currAccount}`, '');
        }
        return configGroupRoot;
    }

    /**
     * lazy loads account information
     */
    private async getAccount() {
        if (!this.currentAccount) {
            const result = await this.stsGateway.getCallerIdentity();
            this.currentAccount = result.Account || 'unknown';
        }
        return this.currentAccount;
    }
}