#!/bin/bash -ex
# Build then deploy entire infrastructure.

sam build
sam deploy
