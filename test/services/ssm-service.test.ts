import { Parameter } from '@aws-sdk/client-ssm';
import { Config, ConfigGroup } from '../../lib';
import { SsmGateway } from '../../lib/gateways/ssm-param-gateway';
import { SsmService } from '../../lib/services/ssm-service';

jest.mock('../../lib/gateways/ssm-param-gateway')

describe('SsmService Test', () => {
    const OLD_ENV = process.env;

    let ssmService: SsmService;
    let mockSsmGateway: SsmGateway;

    const param1: Parameter = { Name: '/donkey/one', Value: 'Brian' };
    const param2: Parameter = { Name: '/mule/two', Value: 'Peter' };
    const existingParameters: Parameter[] = [param1, param2];


    const configGroups: ConfigGroup[] = [
        {
            configGroupName: "groupName",
            configGroupRoot: "/group/root",
            fullPath: "/group/root/value/donkeys.yaml",
            relativePath: "./value/donkeys",
            configSetArray: [
                { key: param1.Name || '', value: param1.Value || '' },
                { key: param2.Name || '', value: param2.Value || '' },
            ],
            configSets: {
                [param1.Name || '']: param1.Value || '',
                [param2.Name || '']: param2.Value || '',
            },

        },
        {
            configGroupName: "groupName2",
            configGroupRoot: "/group/root2",
            fullPath: "/group/root/value/donkeys2.yaml",
            relativePath: "./value/donkeys2",
            configSetArray: [
                { key: `${param1.Name}2`, value: `${param1.Value}2`},
                { key: `${param2.Name}2`, value: `${param2.Value}2` },
            ],
            configSets: {
                [`${param1.Name}2`]: `${param1.Value}2`,
                [`${param2.Name}2`]: `${param2.Value}2`,
            },

        }
    ]

    beforeEach(() => {
        jest.resetModules() // this is important - it clears the cache
        process.env = { ...OLD_ENV };
        delete process.env.NODE_ENV;
        process.env.CDK_DEFAULT_ACCOUNT = '111111111111';
        
        mockSsmGateway = new SsmGateway();
        ssmService = new SsmService(mockSsmGateway);
    });

    afterEach(() => {
        process.env = OLD_ENV;
    });


    test('should determine that update is required', async () => {

        const paramThatExists: Config = { key: param1.Name || '', value: param1.Value || '' };
        const paramDiffValue: Config = { key: param1.Name || '', value: 'Griffin' };
        const paramNewKey: Config = { key: 'notADonkey', value: param1.Value || '' };

        expect(ssmService.updateRequired(paramThatExists, existingParameters)).toBeFalsy();
        expect(ssmService.updateRequired(paramDiffValue, existingParameters)).toBeTruthy();
        expect(ssmService.updateRequired(paramNewKey, existingParameters)).toBeTruthy();
    })

    test('should detect key in config group', async () => {

        const existingKeyResult = ssmService.configGroupsContainsKey(configGroups, param1.Name)
        const newKeyResult = ssmService.configGroupsContainsKey(configGroups, 'newKey')
        expect(existingKeyResult).toBeTruthy();
        expect(newKeyResult).toBeFalsy();

    })

    test('should get the correct parameters to delete', async () => {

        // configGroups is a super set
        const orphanedParams = ssmService.getParametersToDelete(configGroups, existingParameters);
        expect(orphanedParams).toHaveLength(0);

        // config groups is a sub set 
        const extra1: Parameter = { Name: '/extra/one', Value: 'Brian' };
        const extra2: Parameter = { Name: '/extra/two', Value: 'Peter' };
        
        const extraParams: Parameter[] = [
            ...existingParameters,
            extra1,
            extra2,
        ]

        const extraParamsToDelete = ssmService.getParametersToDelete(configGroups, extraParams);
        expect(extraParamsToDelete).toHaveLength(2);
        expect(extraParamsToDelete[0].Name).toMatch(extra1.Name!)
        expect(extraParamsToDelete[1].Name).toMatch(extra2.Name!)

    })

    //TODO: jest, you little..   ugh, ok.. calm down, fix this. 
    // test('should call delete parameter x times when batch processing', async () => {

    //     const elevenParams: Parameter[] = [
    //         param1, param1, param1, param1, param1,
    //         param2, param2, param2, param2, param2,
    //         param1,
    //     ]
        
    //     mockSsmGateway.deleteParameter = jest.fn(() => Promise.resolve());
    //     mockSsmGateway.deleteParameters = jest.fn(() => Promise.resolve());
    //     ssmService = new SsmService(mockSsmGateway);

    //     jest.spyOn(SsmGateway.prototype,'deleteParameters').mockImplementation(() => { return Promise.resolve()})
    //     ssmService.batchDeleteParameters(elevenParams);
    //     expect(mockSsmGateway.deleteParameters).toBeCalledTimes(3)
    // })
})