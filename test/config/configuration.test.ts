import config = require('../../lib/config/configuration')
import path = require('path')
import { AssertionError } from 'assert';

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

test('Loads object into flat pathed keys and values', () => {

  const ssmRootPath = '/test/digital' + '/dev';

  const conf = new config.ConfigLoader({ ssmRootPath: '/junk', rootDir: 'junk' })
  const fileContents = {
    PitneyBowes:
      { vaulthost: 'playpen-billing-renderer.playpen.dsl.aws.shaw.ca' },
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

test('Throws Exception when ssmRootPath ends in a slash', ()=> {
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
