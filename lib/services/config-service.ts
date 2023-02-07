import { Parameter } from "@aws-sdk/client-ssm";
import * as log from "lambda-log";
import { SsmGateway } from "../gateways/ssm-param-gateway";

export const DEFAULT_TARGET_NAMESPACE = "default";
export const DEFAULT_TARGET_CONFIG_ROOT = "/dev-config";
export const CONFIG_DESTINATION_CONFIG_ROOT = "/config-root-deploy-targets";

export type ConfigTarget = {
    namespace: string;
    targetConfigRoot: string;
};

export class ConfigService {
    ssmGateway: SsmGateway;

    currentAccount: string;
    public constructor(ssmGateway?: SsmGateway) {
        this.ssmGateway = ssmGateway || new SsmGateway();
        log.debug("Config Service Created");
    }

    async getSsmTargetPathConfiguration(): Promise<ConfigTarget[]> {
        log.debug(`Looking up ssm paths: ${CONFIG_DESTINATION_CONFIG_ROOT} for target config-root.`);
        const configParams = await this.ssmGateway.getParametersByPath(CONFIG_DESTINATION_CONFIG_ROOT);

        const targets: (ConfigTarget | undefined)[] = configParams.map((x: Parameter) => {
            if (!x.Name || !x.Value) return undefined;
            const namespace = x.Name?.replace(`${CONFIG_DESTINATION_CONFIG_ROOT}/`, "");
            let targetConfigRoot = x.Value;

            if(namespace && namespace === DEFAULT_TARGET_NAMESPACE){
                targetConfigRoot = `${x.Value}/${namespace}`
            }
            return {
                namespace,
                targetConfigRoot,
            };
        });

        // filter undefined
        return targets.filter((item): item is ConfigTarget => !!item);
    }
}
