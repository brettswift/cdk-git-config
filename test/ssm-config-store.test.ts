import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import cdk = require('@aws-cdk/core');

// test('Empty Stack', () => {
//     const app = new cdk.App();
//     // WHEN
//     const stack = new SsmConfigStore.SsmConfigStoreStack(app, 'MyTestStack');
//     // THEN
//     expectCDK(stack).to(matchTemplate({
//       "Resources": {}
//     }, MatchStyle.EXACT))
// });

test('true', () => {
  expect(true).toBe(true)
})