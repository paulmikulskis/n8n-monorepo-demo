#!/bin/bash

# Ensure that the /root/.n8n/custom directory exists
mkdir -p /root/.n8n/custom

# Navigate to the custom directory
cd /root/.n8n/custom

# Initialize a package.json if it does not exist
if [ ! -f package.json ]; then
    npm init -y
fi

# Link the n8nodes package
npm link n8nodes

# Start n8n
ape-flows start
