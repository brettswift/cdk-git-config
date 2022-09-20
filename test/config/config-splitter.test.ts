import config = require('../../lib/config/configuration')
import path = require('path')
import { ConfigGroup, FilteredConfigGroup } from '../../lib/config/types/config-types';
import * as lib from '../../lib';
import { getFilterName, getOrCreateFilterGroup } from '../../lib';

describe('config-splitter', () => {

  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules() // this is important - it clears the cache
    process.env = { ...OLD_ENV };
    delete process.env.NODE_ENV;
    process.env.CDK_DEFAULT_ACCOUNT = '111111111111';
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('Splits stacks based on depth of configuration values', () => {

    process.env.CDK_DEFAULT_ACCOUNT = '12345678'
    const testRoot = path.resolve(__dirname + '../../data/config');
    const conf = new config.ConfigLoader({ ssmRootPath: '/level1/level2', rootDir: testRoot })
    const allGroups: ConfigGroup[] = conf.load();
   
    const splitGroups: FilteredConfigGroup[] = lib.splitGroupsAtPathDepth(allGroups, 1);

    const allSplitGroupLengths = splitGroups.map(x => x.groups.length)
    const totalSplitGroupCount = allSplitGroupLengths.reduce((sum, x) => sum + x, 0)

    expect(splitGroups.length).toEqual(3);
    expect(totalSplitGroupCount).toEqual(allGroups.length);

  })

  test('Should get filter name from config group and depth', () => {
    const configGroup: ConfigGroup = {
      relativePath: './app1/common.yaml',
      fullPath: '/var/config/app1/common.yaml',
      configGroupName: 'app1/common',
      configSets: { '/gitconfigstore/root/account/111111111111/vpc-id': '123456' },
      configSetArray: [{ key: '/gitconfigstore/root/account/111111111111/vpc-id', value: '123456' }],
      configGroupRoot: '/var/config/app1',
    } 
 
    expect(getFilterName(configGroup,2)).toEqual('app1/common')
    expect(getFilterName(configGroup,1)).toEqual('app1')
    expect(getFilterName(configGroup,0)).toEqual('')

  })

  function getFilterGroups() : FilteredConfigGroup[] {

    return [
      {
        filteredByPath: 'app1',
        groups: [{configGroupName: 'app1'}],
      }as FilteredConfigGroup,
      {
        filteredByPath: 'app2',
        groups: [],
      }as FilteredConfigGroup,
      {
        filteredByPath: 'app3',
        groups: [],
      }as FilteredConfigGroup,
    ]
  }

  test('Should create filter group from new filter name', () => {
    const filterGroups = getFilterGroups();
    const filterName = 'test1';
    const newGroup = getOrCreateFilterGroup(filterGroups, filterName);

    expect(newGroup.filteredByPath).toEqual(filterName);
  })
  
  test('Should create filter group from existing filter name', () => {
    const filterGroups = getFilterGroups();
    const filterName = 'app1';
    const newGroup = getOrCreateFilterGroup(filterGroups, filterName);

    expect(newGroup.filteredByPath).toEqual(filterName);
    expect(newGroup.groups).toHaveLength(1);
  })
})