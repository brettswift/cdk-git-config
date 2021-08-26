import { ConfigGroup } from "./types/config-types"



/**
* Prints configuration to STDOUT.
* 
* Call this if you want to eyeball the values that would end up in SSM.
*/
export function printConfiguration(configGroup: ConfigGroup[]) {

    console.log(" - - - Configuration - - - ")
    console.log(`Config Values: `)

    configGroup.forEach(configGroup => {
        Object.keys(configGroup.configSets).forEach((key) => {
            const value = configGroup.configSets[key]
            console.log(`  ${key}:   ${value}`)
        })
    })
    console.log(' - - - ')
}
