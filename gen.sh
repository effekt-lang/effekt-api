#!/usr/bin/env sh
set -e

mkdir -p build/ out/
rm -rf out/* build/*

prelude=$(effekt --show-prelude)

# this complex json maneuver is required because .json files of same basename get overwritten by effekt!
for file in $(find effekt/libraries/ -type f -name "*.effekt"); do
	json=out/"$(basename "$file")".json
	if [ -f "$json" ]; then mv "$json" out/"$(basename "$file")"_.json; fi
	effekt -o out/ --write-documentation "$file"
done

cat out/*.json | jq -c -s . >build/full.json
gzip build/full.json

node convert.js "$1" "$prelude"
node index.js "$1" "$prelude" >build/index."$1"

# we copy the static files into *every* subdirectory
# this is a hack, but makes importing files a lot simpler!
for dir in $(find build -type d); do
	cp common.js static/* "$dir"
done
