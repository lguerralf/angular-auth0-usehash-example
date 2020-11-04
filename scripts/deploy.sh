#!/usr/bin/env bash

cd frontend
yarn build

cd ../infrastructure
cdk deploy --verbose --debug --require-approval never
