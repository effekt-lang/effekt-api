#!/usr/bin/env sh
set -e

mkdir -p build/ out/
rm -rf out/* build/*

prelude=$(effekt --show-prelude)

effekt -o out/ --write-documentation $(find effekt/libraries/ -type f -name "*.effekt")
cat out/*.json | jq -c -s . >build/full.json
gzip build/full.json

node convert.js "$1" "$prelude"
node index.js "$1" "$prelude" >build/index."$1"

# we copy the static files into *every* subdirectory
# this is a hack, but makes importing files a lot simpler!
for dir in $(find build -type d); do
	cp common.js static/* "$dir"
done
