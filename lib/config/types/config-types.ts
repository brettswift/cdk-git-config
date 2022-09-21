
/**
 * A ConfigGroup is a representation of a config file with values inside it flattened out.
 * Some metadata is added to it describing where the values came from, which are useful when deploying
 */
export interface ConfigGroup {
    relativePath: string;
    fullPath: string;
    // configSets are a key value pair, where the key is a valid SSM path.
    configSets: { [key: string]: string };
    /**
     * A replica of configSets for convenience;
     */
    configSetArray: Config[];
    /**
     *  configGroupName equals the file name that the config came from. 
     * ex dev.yaml will become 'dev'.
     */
    configGroupName: string;
    /**
     * The root path of this specific config set
     */
    configGroupRoot: string;
}

export interface FilteredConfigGroup {
    /**
     * A set of config groups, with a common sub path.
     */
    groups: ConfigGroup[];
    /**
     * The sub path that all config groups have in common 
     */
    filteredByPath: string;
}

export type Configs = Config[]
/**
 * single internal representation of an ssm parameter.
 */
export interface Config {
    key: string;
    value: string;
}