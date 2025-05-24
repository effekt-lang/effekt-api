#!/usr/bin/env sh

mkdir -p build/ out/
#rm -f out/* build/*
rm -f build/*

effekt.sh -o out/ --write-documentation $(find effekt/libraries/ -type f -name "*.effekt")
cat out/*.json | jq -c -s . >build/full.json
gzip build/full.json

cp static/* build/
node convert.js "$1"
node index.js "$1" >build/index."$1"
