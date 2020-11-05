#!/usr/bin/env bash

cd frontend
yarn build

cd ../infrastructure
npm run build
cdk deploy --verbose --debug --require-approval never
