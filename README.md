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

## Example

See the examples folder for a deployable stack you can use to evaluate.

## Deficiencies / TODO

* Secure parameters - currently not supported
* Include a CodePipeline construct, as automating this is critical.

## Contributing

PR's welcome.  Issues / requests welcome.
