// generate an index.html with all modules, grouped by their subdirectories

import fs from "node:fs";
import { htmlDumpMultipleDispatch } from "./htmlWriter.js";
import { moduleFile, moduleDir, stripSource } from "./common.js";

// note: we could easily render the *entire* library on / as well
const dumpModule = (ctx) => (obj) => {
  ctx.heading(
    ctx.depth,
    "Module",
    `<a class="moduleLink" href="${moduleFile(obj.source)}.html">${obj.module.path}</a>`,
    "",
    true,
  );
};

function dumpAll(dataDir, dumper) {
  // we need to use node's synchronous API, since we use multiple dispatch dumping
  const dir = fs.opendirSync(dataDir);
  const dirents = [];
  let dirent;
  while ((dirent = dir.readSync()) !== null) dirents.push(dirent.name);

  const commonDirs = {};
  dirents.sort().forEach((dirent) => {
    const data = fs.readFileSync(`${dataDir}/${dirent}`, "utf8");
    const docs = JSON.parse(data);
    const dir = moduleDir(docs.source);

    if (dir in commonDirs) commonDirs[dir].push(docs);
    else commonDirs[dir] = [docs];
  });

  for (const dir in commonDirs) {
    for (const obj of commonDirs[dir]) {
      dumper = dumper(obj);
    }
  }

  dumper(null);
}

dumpAll("out", htmlDumpMultipleDispatch(console.log, dumpModule));
