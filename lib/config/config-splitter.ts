import { ConfigGroup, FilteredConfigGroup } from "./types/config-types";


/**
 * 
 * @param configGroups Config Groups we want to split into FilteredConfigGroups
 * @param depth The depth of the path in the config file directory tree, to split the groups on.
 *               Does not consider the root directory.
 *               Example depth: 1 with a root dir of config, and paths of: 
 *                          config/env1/file1.yaml
 *                          config/env2/file1.yaml
 *                     would give you two FilteredConfigGroup's grouped at env1, and env2.
 *               A depth of 0 would return the same set as was passed in.
 * @returns 
 */
export function splitGroupsAtPathDepth(configGroups: ConfigGroup[], depth: number): FilteredConfigGroup[] {
    const splitGroups: FilteredConfigGroup[] = [];

    configGroups.forEach(group => {

      const filterName = getFilterName(group, depth); 
      const filterGroup: FilteredConfigGroup = getOrCreateFilterGroup(splitGroups, filterName);

      if(!splitGroups.includes(filterGroup)) splitGroups.push(filterGroup);

      if(group.configGroupName.startsWith(filterName))
        filterGroup.groups.push(group);

    })

    return splitGroups;
}

export function getFilterName(group: ConfigGroup, depth: number): string {

    let groupParts = group.configGroupName.split('/');

    groupParts = groupParts.slice(0,depth);

    return groupParts.join('/')

}

export function getOrCreateFilterGroup(allFilterGroups: FilteredConfigGroup[], filterName: string): FilteredConfigGroup{

    const foundGroup = allFilterGroups.find(x => x.filteredByPath === filterName )

    if(foundGroup) return foundGroup;

    return {
        filteredByPath: filterName,
        groups: []
    }as FilteredConfigGroup
}

