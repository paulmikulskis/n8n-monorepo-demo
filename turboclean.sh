#!/bin/bash

# In a monorepo built with Turborepo like this one, removing the directories
# and files specified in the TO_REMOVE array (such as "build", "dist", and "node_modules")
# can be useful when trying to rebuild the monorepo or troubleshoot issues
# with the codebase. These directories and files often contain build artifacts
# or dependencies that may not be necessary for the current state of the codebase,
# and removing them can help to ensure that the monorepo is in a clean state before rebuilding.

# Define the list of files and directories to remove
TO_REMOVE=(
    "build"
    "dist"
    "node_modules"
    ".turbo"
)

# Go through each element in the list
for element in "${TO_REMOVE[@]}"; do
    rm -rf $element
done

for dir in "apps" "packages"; do
    cd $dir
    for element in "${TO_REMOVE[@]}"; do
        rm -rf **/$element
    done
    cd ..
done

echo " 🧽 🚿 scrub-a-dub-dub, 'node_modules' is done!"
