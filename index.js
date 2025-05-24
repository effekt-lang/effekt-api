const fs = require("node:fs");
const { htmlDumpMultipleDispatch } = require("./htmlWriter");

const dumpModule = (ctx) => (obj) => {
  // generate headings, but only for TOC
  ctx.heading(ctx.depth, "Module", obj.module.path, "", true);
};

function dumpAll(dataDir, dumper) {
  // we need to use node's synchronous API, since we use multiple dispatch dumping
  const dir = fs.opendirSync(dataDir);

  let dirent;
  while ((dirent = dir.readSync()) !== null) {
    const data = fs.readFileSync(`${dataDir}/${dirent.name}`, "utf8");
    const docs = JSON.parse(data);
    dumper = dumper(docs);
  }

  dumper(null);
}

const dumper =
  process.argv[2] === "html"
    ? htmlDumpMultipleDispatch
    : console.error("unimplemented");
dumpAll("out", dumper(console.log, dumpModule));
