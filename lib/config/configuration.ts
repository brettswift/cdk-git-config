import yaml = require('js-yaml')
import glob = require('glob')
import flat = require('flat')
import fs = require('fs');
import path = require('path');
import assert = require('assert')

/**
 * Configuration describing how to load and parse the config files
 */
export interface ConfigurationProps {
    // The root directory where the config should be defined.
    rootDir: string
    // A path in SSM that will prefix all paths that come out of the config files.
    ssmRootPath: string
}

/**
 * A ConfigGroup is a representation of a config file with values inside it flattened out.
 * Some metadata is added to it describing where the values came from, which are useful when deploying
 */
export interface ConfigGroup {
    relativePath: string
    fullPath: string
    // configSets are a key value pair, where the key is a valid SSM path.
    configSets: { [key: string]: string }
    /**
     *  configGroupName equals the file name that the config came from. 
     * ex dev.yaml will become 'dev'.
     */
    configGroupName: string
}

// TODO: accept a parameter 'templateBreakoutDepth' that will split out templates into folders by depth. 
//       as is would represent a value of 0 in that param
export class ConfigLoader {
    private rootDir: string
    private ssmRootPath: string;
    private _configuration: ConfigGroup[]

    constructor(props: ConfigurationProps) {
        this.rootDir = props.rootDir
        this.ssmRootPath = props.ssmRootPath

        this.validateProps(props)
    }

    /**
     * A list of configuration groups, representing all files that were loaded. 
     * Each group has a list of configurations flattened out.
     */
    public get configuration(): ConfigGroup[]{
        if(!this._configuration){
            throw new assert.AssertionError({message: "Configuration is empty. Please call load()."})
        }
        return this._configuration
    }

    /**
     * Prints configuration to STDOUT.
     * 
     * Call this if you want to eyeball the values that would end up in SSM.
     */
    public printConfiguration(){

        console.log(" - - - Configuration - - - ")
        console.log(`Config Root Directory: ${this.rootDir}`)
        console.log(`Ssm Target Root Path: ${this.ssmRootPath}`)
        console.log(`Config Values: `)

        this._configuration.forEach(configGroup => {
            Object.keys(configGroup.configSets).forEach((key)=> {
                const value = configGroup.configSets[key]
                console.log(`  ${key}:   ${value}`)
            })
        })
        console.log(' - - - ')
    }

    public load(): ConfigGroup[] {
        const configGroups = this.getListOfConfigFiles(this.rootDir);
        this._configuration = configGroups
        return configGroups
    }

    private validateProps(props: ConfigurationProps){
        if(props.ssmRootPath.endsWith('/')){
            throw new assert.AssertionError({message: 'ssmRootPath can not end in a slash'})
        }

         if(!props.ssmRootPath.startsWith('/')){
            throw new assert.AssertionError({message: 'ssmRootPath must start with a leading slash'})
        }
    }

    private loadYamlFile(file: string) {
        const contents = yaml.safeLoad(fs.readFileSync(file, 'utf8'));
        return contents
    }

    /**
     * Globs all yaml files in the given rootDir returning an array of ConfigGroups. 
     * @param rootDir The path containing the yaml config hirearchy
     */
    private getListOfConfigFiles(rootDir: string): ConfigGroup[] {
        const globPath = rootDir + '/**/*.yaml';
        const files = glob.sync(globPath);

        if(files.length == 0){
            throw new assert.AssertionError({message: `Expected to find some files with glob search: ${globPath} but did not.`})
        }
        let configGroups: ConfigGroup[] = []
        let group: ConfigGroup

        files.forEach(filePath => {
            const fileName = path.basename(filePath)
            const filePathPart = fileName.substring(0, fileName.indexOf('.'))
            const fileContents = this.loadYamlFile(filePath)
            const configRoot = `${this.ssmRootPath}/${filePathPart}`
            group = {
                relativePath: `.${filePath.substring(rootDir.length)}`,
                fullPath: filePath,
                configGroupName: filePathPart,
                configSets: this.getValuesFromFileObject(fileContents, configRoot)
            } as ConfigGroup

            configGroups.push(group);
        });
        return configGroups
    }

    /**
     * Flattens a dictionary to a hash of string key/value pairs 
     * @param fileContents contents of a yaml file
     * @param ssmRootPath The path to prefix when flattening the object path.
     */
    private getValuesFromFileObject(fileContents: object, ssmRootPath: string): {[key: string]: string } {

        // TODO: could get rid of this 'flat' dependency and bring that method in.
        const flattened = flat(fileContents,
            { delimiter: '/' }
        )as {[key: string]: string }
        let result: {[key: string]: string } = {}

        Object.keys(flattened).forEach((key) => {
            const value = flattened[key]
            const theKey = `${ssmRootPath}/${key}`
            result[theKey] = value
        })
        return result;

    }
}
