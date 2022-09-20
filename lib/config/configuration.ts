import yaml = require('js-yaml')
import glob = require('glob')
import flat = require('flat')
import fs = require('fs');
import assert = require('assert')
import { Config, ConfigGroup } from './types/config-types';

/**
 * Configuration describing how to load and parse the config files
 */
export interface ConfigurationProps {
    // The root directory where the config should be defined.
    rootDir: string
    // A path in SSM that will prefix all paths that come out of the config files.
    ssmRootPath: string
    /**
     * In the case when this config is deployed to multiple accounts, 
     * and the account configuration is in a file <account_number>.yaml
     * or a folder <account_number>/config.yaml
     * this flag will ignore configurations that do not match the account we are 
     * currently deploying into.
     * @default: true
     */
    filterByCurrentAccount?: boolean
    /**
     * if not set, uses the environment variable: CDK_DEFAULT_ACCOUNT
     */
    currentAccount?: string;
}

export class ConfigLoader {


    private rootDir: string
    public ssmRootPath: string;
    private _configuration: ConfigGroup[]
    private filterByCurrentAccount: boolean;
    currentAccount?: string;

    constructor(props: ConfigurationProps) {
        this.rootDir = props.rootDir
        this.ssmRootPath = props.ssmRootPath
        this.filterByCurrentAccount = (props.filterByCurrentAccount === undefined) ? true : props.filterByCurrentAccount;
        this.validateProps(props)
        this.currentAccount = props.currentAccount;
    }

    /**
     * A list of configuration groups, representing all files that were loaded. 
     * Each group has a list of configurations flattened out.
     */
    public get configuration(): ConfigGroup[] {
        if (!this._configuration) {
            throw new assert.AssertionError({ message: "Configuration is empty. Please call load()." })
        }
        return this._configuration
    }

    public load(): ConfigGroup[] {
        const configGroups = this.getListOfConfigFiles(this.rootDir);
        this._configuration = configGroups
        return configGroups
    }

    private validateProps(props: ConfigurationProps) {
        if (props.ssmRootPath.endsWith('/')) {
            throw new assert.AssertionError({ message: 'ssmRootPath can not end in a slash' })
        }

        if (!props.ssmRootPath.startsWith('/')) {
            throw new assert.AssertionError({ message: 'ssmRootPath must start with a leading slash' })
        }
    }

    private loadYamlFile(file: string): any {
        const contents = yaml.load(fs.readFileSync(file, 'utf8'));
        return contents
    }

    /**
     * If the word account is in the path, and the 
     * @param path The path of the configuration file in question.
     */
    private shouldRenderPath(path: string) {

        if (!this.filterByCurrentAccount) return true
        if (!path.includes('account')) return true

        // TODO: change env var to the sts account gateway, so we aren't reliant on this magical env var from cdk. 
        const currAccount = this.currentAccount || process.env.CDK_DEFAULT_ACCOUNT;
        if (!currAccount) throw new Error("Expected to find CDK account from environment variable process.env.CDK_DEFAULT_ACCOUNT but did not.");
        return path.includes(currAccount);
    }

    /**
     * Globs all yaml files in the given rootDir returning an array of ConfigGroups. 
     * @param rootDir The path containing the yaml config hirearchy
     */
    private getListOfConfigFiles(rootDir: string): ConfigGroup[] {
        const globPath = rootDir + '/**/*.yaml';
        const files = glob.sync(globPath);

        if (files.length == 0) {
            throw new assert.AssertionError({ message: `Expected to find some files with glob search: ${globPath} but did not.` });
        }
        let configGroups: ConfigGroup[] = [];
        let group: ConfigGroup;

        files.forEach(filePath => {
            // examples are from the example/config project.
            //fullFilePathPart: app1/bswift.yaml
            const fullFilePathPart = filePath.replace(`${rootDir}/`, '');
            //parentFolderRelativeToRoot: app1/bswift
            const parentFolderRelativeToRoot = fullFilePathPart.substring(0, fullFilePathPart.indexOf('.'));
            //configRoot: /gitconfigstore/root/app1/bswift
            const configGroupRoot = `${this.ssmRootPath}/${parentFolderRelativeToRoot}`;
            //relativeFilePath: ./app1/bswift.yaml
            const relativeFilePath = `.${filePath.substring(rootDir.length)}`;
            const fileContents: object = this.loadYamlFile(filePath);

            if (!this.shouldRenderPath(fullFilePathPart)) return;

            if (!fileContents) throw new Error("Expected file Contents to not be null")
            const configSets = this.getValuesFromFileObject(fileContents, configGroupRoot);
            group = {
                relativePath: relativeFilePath,
                fullPath: filePath,
                configGroupName: parentFolderRelativeToRoot,
                configSets,
                configSetArray: this.deserializeConfigSet(configSets),
                configGroupRoot,
            }

            configGroups.push(group);
        });
        return configGroups
    }

    /**
     * 
     * @returns an array of Configs for convenience.
     */
    deserializeConfigSet(configSets: { [key: string]: string; }): Config[] {
        const configs: Config[] = [];
        Object.keys(configSets).forEach((key) => {
            const value = configSets[key]
            configs.push({ key, value });
        })
        return configs;
    }

    /**
     * Returns an SSM Key path omitting the account number.
     * @param rawKey the SSM key which may contain an account number in it.
     */
    private filterAccountFromSsmKey(rawKey: string): string {
        if (!this.filterByCurrentAccount) return rawKey;

        const currAccount = this.currentAccount || process.env.CDK_DEFAULT_ACCOUNT
        if (!currAccount) throw new Error("Expected to find CDK account from environment variable process.env.CDK_DEFAULT_ACCOUNT but did not.");

        let filteredKey = rawKey.replace(currAccount, '');
        filteredKey = filteredKey.replace('//', '/');
        return filteredKey;
    }

    /**
     * Flattens a dictionary to a hash of string key/value pairs 
     * @param fileContents contents of a yaml file
     * @param ssmRootPath The path to prefix when flattening the object path.
     */
    private getValuesFromFileObject(fileContents: object, ssmRootPath: string): { [key: string]: string } {

        // TODO: could get rid of this 'flat' dependency and bring that method in.
        const flattened = flat(fileContents,
            { delimiter: '/' }
        ) as { [key: string]: string };
        let result: { [key: string]: string } = {};

        Object.keys(flattened).forEach((key) => {
            const value = flattened[key];
            const theKey = this.filterAccountFromSsmKey(`${ssmRootPath}/${key}`);
            result[theKey] = value;
        })
        return result;
    }
}
