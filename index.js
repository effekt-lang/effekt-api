// generate an index.html with all modules

const fs = require("node:fs");
const { htmlDumpMultipleDispatch } = require("./htmlWriter");

const dumpModule = (ctx) => (obj) => {
  ctx.heading(
    ctx.depth,
    "Module",
    `<a href="${obj.module.path}.html">${obj.module.path}</a>`,
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

  dirents.sort().forEach((dirent) => {
    const data = fs.readFileSync(`${dataDir}/${dirent}`, "utf8");
    const docs = JSON.parse(data);
    dumper = dumper(docs);
  });

  dumper(null);
}

dumpAll("out", htmlDumpMultipleDispatch(console.log, dumpModule));
