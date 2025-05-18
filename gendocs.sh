#!/usr/bin/env sh

mkdir -p build/ out/
rm -f out/* build/*

effekt.sh -o out/ --write-documentation $(find effekt/libraries/ -type f -name "*.effekt")
cat out/*.json | jq -c -s . >build/full.json
gzip build/full.json

cp static/* build/
node dumpMarkdown.js html
