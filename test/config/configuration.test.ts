import config = require('../../lib/config/configuration')
import path = require('path')
import { AssertionError } from 'assert';

describe('environmental variables', () => {
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

  // test('Configuration', () => {
  //   const project_root_path = path.resolve(__dirname + '../../../');
  //   const configPath = path.resolve(project_root_path + '/config')
  //   console.log(`Config Path: ${configPath}`)

  //   const conf = new config.Configuration({rootDir: configPath})
  //   const files = conf.load();

  //   console.log(files)

  //   // WHEN
  //   // const stack = new SsmConfigStore.SsmConfigStoreStack(app, 'MyTestStack');
  //   // THEN
  //   // expectCDK(stack).to(matchTemplate({
  //   //   "Resources": {}
  //   // }, MatchStyle.EXACT))
  // });

  test('Yaml file loads', () => {
    const testRoot = path.resolve(__dirname + '/../data/config');
    const configFile = path.resolve(testRoot + '/app1/dev.yaml')

    const conf = new config.ConfigLoader({ ssmRootPath: '/junk', rootDir: 'junk' })
    const result = conf['loadYamlFile'](configFile)

    expect(result).toHaveProperty('Logging')
  })

  test('Loads list of config files', () => {
    const testRoot = path.resolve(__dirname + '../../data/config');
    const conf = new config.ConfigLoader({ ssmRootPath: '/test/digital', rootDir: testRoot })
    const configGroups = conf['getListOfConfigFiles'](testRoot)

    expect(configGroups).toHaveLength(4)
  })

  test('Determines a path should not be rendered when account filtering active ', () => {
    const testRoot = path.resolve(__dirname + '../../data/config');
    const conf = new config.ConfigLoader({ ssmRootPath: '/test/digital', rootDir: testRoot })

    process.env.CDK_DEFAULT_ACCOUNT = '111111111111';
    expect(conf['shouldRenderPath']('account/123456789112.yaml')).toBeFalsy()
    expect(conf['shouldRenderPath']('account/123456789112/moreconfig.yaml')).toBeFalsy()

  })

  test('Determines a path should be rendered when account filtering active ', () => {
    const testRoot = path.resolve(__dirname + '../../data/config');
    const conf = new config.ConfigLoader({ ssmRootPath: '/test/digital', rootDir: testRoot })

    process.env.CDK_DEFAULT_ACCOUNT = '123456789112';
    expect(conf['shouldRenderPath']('account/123456789112.yaml')).toBeTruthy()
    expect(conf['shouldRenderPath']('account/123456789112/moreconfig.yaml')).toBeTruthy()

  })

  test('Determines a path should be rendered when account filtering disaabled and current account does not match', () => {
    const testRoot = path.resolve(__dirname + '../../data/config');
    const conf = new config.ConfigLoader({ ssmRootPath: '/test/digital', rootDir: testRoot, filterByCurrentAccount: false })

    process.env.CDK_DEFAULT_ACCOUNT = '111111111111';
    expect(conf['shouldRenderPath']('account/123456789112.yaml')).toBeTruthy()
    expect(conf['shouldRenderPath']('account/123456789112/moreconfig.yaml')).toBeTruthy()

  })

  test('Determines a path should be rendered when account filtering disabled ', () => {
    const testRoot = path.resolve(__dirname + '../../data/config');
    const conf = new config.ConfigLoader({ ssmRootPath: '/test/digital', rootDir: testRoot, filterByCurrentAccount: false })

    process.env.CDK_DEFAULT_ACCOUNT = '123456789112';
    expect(conf['shouldRenderPath']('account/123456789112.yaml')).toBeTruthy()
    expect(conf['shouldRenderPath']('account/123456789112/moreconfig.yaml')).toBeTruthy()

  })

  test('Removes the Account from the SSM Path', () => {
    const testRoot = path.resolve(__dirname + '../../data/config');
    const conf = new config.ConfigLoader({ ssmRootPath: '/test/digital', rootDir: testRoot })

    process.env.CDK_DEFAULT_ACCOUNT = '964705782699';
    expect(conf['filterAccountFromSsmKey']('account/964705782699/vpc-id')).toEqual('account/vpc-id')

  })

  test('Does not remove the Account from the SSM Path', () => {
    const testRoot = path.resolve(__dirname + '../../data/config');
    const conf = new config.ConfigLoader({ ssmRootPath: '/test/digital', rootDir: testRoot, filterByCurrentAccount: false})

    process.env.CDK_DEFAULT_ACCOUNT = '964705782699';
    expect(conf['filterAccountFromSsmKey']('account/964705782699/vpc-id')).toEqual('account/964705782699/vpc-id')
    expect(conf['filterAccountFromSsmKey']('account/111111111111/vpc-id')).toEqual('account/111111111111/vpc-id')

  })

  test('Loads object into flat pathed keys and values', () => {

    const ssmRootPath = '/test/digital' + '/dev';

    const conf = new config.ConfigLoader({ ssmRootPath: '/junk', rootDir: 'junk' })
    const fileContents = {
      PitneyBowes:
        { vaulthost: 'playpen-billing-renderer' },
      Logging: {
        LogLevel: { Default: 'Information' }
      }
    }

    const filePaths = conf['getValuesFromFileObject'](fileContents, ssmRootPath)

    expect(Object.keys(filePaths)[0]).toEqual(ssmRootPath + '/PitneyBowes/vaulthost')

  })

  test('Throws Exception when no config files found', () => {
    const badPath = path.resolve(__dirname + '../../bad/path');
    const conf = new config.ConfigLoader({ ssmRootPath: '/level1/level2', rootDir: badPath })

    expect(() => {
      conf.load()
    }).toThrowError(AssertionError)
  })

  test('Throws Exception when ssmRootPath ends in a slash', () => {
    expect(() => {
      new config.ConfigLoader({ ssmRootPath: '/level1/level2/', rootDir: './' })
    }).toThrowError(AssertionError)
  })

  test('Integration - Loads full config path into key / value pairs', () => {
    const testRoot = path.resolve(__dirname + '../../data/config');

    const conf = new config.ConfigLoader({ ssmRootPath: '/level1/level2', rootDir: testRoot })

    const result = conf.load();

    result.forEach(group => {
      group.configSets
    });
  })
})