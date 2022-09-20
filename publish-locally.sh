#!/usr/bin/env bash 

echo "Publishing cdk-git-config locally to verdaccio"


npm run build

# npm version prepatch --force
npm version prerelease --force --no-git-tag-version
npm publish  --registry http://localhost:4873/ --tag dev

