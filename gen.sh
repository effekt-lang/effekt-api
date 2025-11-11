#!/usr/bin/env sh
set -e

mkdir -p build/ out/
rm -rf out/* build/*

prelude=$(effekt --show-prelude)

for file in $(find effekt/libraries/ -type f -name "*.effekt"); do
	effekt -o out/ --write-documentation "$file"
	cat out/"$(basename $file)".json >>build/raw.json
done

cat out/raw.json | jq -c -s . >build/full.json
gzip build/full.json

node convert.js "$1" "$prelude"
node index.js "$1" "$prelude" >build/index."$1"

cp common.js static/* "$dir"

# we copy the static files into *every* subdirectory
# this is a hack, but makes importing files a lot simpler!
for dir in $(find build -type d); do
	cp common.js static/* "$dir"
done
