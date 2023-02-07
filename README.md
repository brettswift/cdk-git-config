# CDK Git Config

An AWS CDK construct that will replicate a directory structure of yaml files into AWS SSM. (Or other providers like DynamoDB / S3 in the future).

## Motivation

In Continuous Delivery, you need to tweak configuration in production at runtime, quickly, without flowing through your entire dev --> staging --> prod pipeline.  This can be called "out of band" configuration.  Alternative to "in-band" configuration which is committed to your software git repo, and updates when the software is deployed.

One popular way of storing out of band configuration is SSM.  However this can get out of hand quickly.

Having configuration stored in git, with a simple interface (yaml) is nice.  So lets do that, and replicate the directory via CDK / Cloudformation into AWS SSM!

Key advantages:

* history of out of band configuration
* easy to revert to previous configuration
* Pull Requests, added options for reviewing configuration (prod & dev)
* Easy to replicate into new accounts.

## Configuration

There's a minimal configuration in SSM required.  The configuration tells this app which SSM root path to deploy the configuration tree.

You must supply `/config-root-deploy-targets/default`.   Optionally, or additionally, you can swap out 'default' for a specific namespace.

### Determining deployment path

1. If you run this app with a namespace that does not have configuration, that namespace is tacked onto the default path.
2. If your namespace is conifigured, it will run directly at that path.

### Example Configuration2. If your namespace is conifigured, it will run directly at that path

### Example Configuration

Given this configuration:

``` yaml
/config-root-deploy-targets/default: /dev-config
/config-root-deploy-targets/bswift: /dev-config
/config-root-deploy-targets/live: /live-config
```

Running this app with the following parameters will result in configuration at the following paths:

1. `cdk-git-config --namespace jsmith --configDir ./
   1. uses ssm root of `/dev-config/jsmith`
2. `cdk-git-config --namespace bswift --configDir ./
   1. uses ssm root of `/dev-config`
3. `cdk-git-config --namespace live --configDir ./
   1. uses ssm root of `/live-config`

**Recommended usage**: configure a default path, which all development namespaces can use to deploy to.  Configure a production namespace explicitly.

## Example execution (development)

``` bash
# minimal configuration for this app to run.
# will result in /dev-config/{namespace}/...configuration
aws ssm put-parameter --name /config-root-deploy-targets/default  --value "/dev-config" --type String --overwrite
# will result in /live-config/v1/...configuration
aws ssm put-parameter --name /config-root-deploy-targets/live  --value "/live-config/v1" --type String --overwrite

npm i && npm run build
 ts-node bin/entrypoint.ts --namespace bswift --configDir test/data/config/
```

## Deficiencies / TODO

* Secure parameters - currently not supported
* Include a CodePipeline / step function construct, as automating this is critical.

## Releasing

1. Merge PR to master
2. Run the release script according to what type of release this should be
    * `npm run release-[major|minor|patch]`
    * This will:
        * create the appropriate release number in package.json
        * create the tag, and commit
        * Finally push the tag and commit up
        * Travis will run the build and release to NPM.

## Contributing

PR's welcome.  Issues / requests welcome.
