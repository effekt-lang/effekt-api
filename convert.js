/// this generator is written in such a way that we could easily translate
/// it to Effekt code. `ctx` resembles an interface, where its functions are
/// effects that write the documentation (e.g. using htmlWriter)

import fs from "node:fs";
import { htmlDump } from "./htmlWriter.js";
import { markdownDump } from "./markdownWriter.js";
import { stripSource, moduleFile, moduleDir } from "./common.js";

const TARGET = process.argv[2];
const PRELUDE = process.argv[3].split(",");

const sanitizeDoc = (doc) => {
  return doc
    .split("\n")
    .map((line) => {
      if (line[0] == " ") return line.substring(1);
      else return line;
    })
    .join("\n");
};

const dumpDoc = (ctx) => (doc) => ctx.addDoc(sanitizeDoc(doc) ?? "");

const showType = (ctx) => (t) => {
  const optional = (arr, f) =>
    arr.length > 0 ? f(arr.map(showType(ctx)).join(", ")) : "";

  switch (t.kind) {
    case "BoxedType":
      return `${showType(ctx)(t.tpe)} at {${t.capt.map(ctx.id)}}`;
    case "TypeRef":
      return ctx.id(t.id) + optional(t.args, (args) => `[${args}]`);
    case "FunctionBlockParam":
      if ("id" in t || !t.id.name) return `${showType(ctx)(t.tpe)}`;
      return `${ctx.id(t.id)}: ${showType(ctx)(t.tpe)}`;
    case "FunctionType":
      return (
        optional(t.vparams, (args) => `(${args})`) +
        optional(t.tparams, (args) => `[${args}]`) +
        optional(t.bparams, (args) => `{${args}}`) +
        ` => ${showType(ctx)(t.result)}` +
        optional(t.effects, (args) => ` / {${args}}`)
      );
    default:
      console.warn("unknown type", t.kind);
  }
};

const showSignature = (ctx) => (term) => {
  let res = "";

  if ("tparams" in term && term.tparams.length > 0)
    res += `[${term.tparams.map(ctx.id).join(", ")}]`;

  if ("vparams" in term && term.vparams.length > 0)
    res += ` (${term.vparams.map(({ id, tpe }) => `${ctx.id(id)}: ${showType(ctx)(tpe)}`).join(", ")})`;

  if ("bparams" in term && term.bparams.length > 0)
    res += ` ${term.bparams.map(({ id, tpe }) => `{ ${ctx.id(id)}: ${showType(ctx)(tpe)} }`).join(" ")}`;

  if ("ret" in term && term.ret.kind === "Effectful")
    res += `: ${showType(ctx)(term.ret.tpe)} / {${term.ret.eff.map(showType(ctx)).join(", ")}} `;

  if (res != "") return `\`${res}\``;
  return "";
};

const dumpFields = (ctx) => (term) => {
  const go = (fields) => {
    fields.forEach((field) => {
      ctx.heading(
        ctx.depth + 1,
        field.kind,
        ctx.id(field.id),
        showSignature(ctx)(field),
        false,
        false,
      );
      dumpDoc(ctx)(field.doc);
    });
  };

  if ("ops" in term) go(term.ops);
  if ("ctors" in term) go(term.ctors);
};

const dumpDefinitions = (ctx) => (term) => {
  if ("definitions" in term)
    term.definitions.forEach(dumpDefinition(ctx.updateDepth(ctx.depth + 1)));
};

const dumpDefinition = (ctx) => (term) => {
  ctx.heading(
    ctx.depth,
    term.kind,
    ctx.id(term.id),
    showSignature(ctx)(term),
    false,
    false,
  );
  dumpDoc(ctx)(term.doc);
  dumpDefinitions(ctx)(term);
  dumpFields(ctx)(term);
};

const dumpModule = (ctx) => (obj) => {
  console.assert(obj.module.kind === "ModuleDecl");
  ctx.heading(
    ctx.depth,
    "Module",
    obj.module.path,
    "",
    false,
    PRELUDE.includes(obj.module.path),
  );
  ctx.write("Jump to source: ");
  ctx.url(
    stripSource(obj.source),
    `https://github.com/effekt-lang/effekt/tree/master/${stripSource(obj.source)}`,
  );
  ctx.write("<br>Example usage: ");
  ctx.url(
    `examples/stdlib/${obj.module.path}`,
    `https://github.com/effekt-lang/effekt/tree/master/examples/stdlib/${obj.module.path}`,
  );
  dumpDoc(ctx)(obj.module.doc); // TODO
  obj.module.defs.forEach(dumpDefinition(ctx.updateDepth(ctx.depth + 1)));
};

async function dumpAll(dataDir, outDir, dumper) {
  const dir = await fs.promises.opendir(dataDir);

  for await (const dirent of dir) {
    console.log(dirent.name);
    fs.readFile(`${dataDir}/${dirent.name}`, "utf8", (err, data) => {
      const docs = JSON.parse(data);
      const file = moduleFile(docs.source);
      const dir = moduleDir(docs.source);

      fs.mkdirSync(`${outDir}/${dir}`, { recursive: true });
      const outName = `${outDir}/${file}.${TARGET}`;
      fs.writeFileSync(outName, ""); // create/clear

      const write = (text) => fs.appendFileSync(outName, text);
      dumper(write, dumpModule)(docs);
    });
  }
}

const dumper = TARGET === "html" ? htmlDump : markdownDump;
dumpAll("out", "build", dumper).catch(console.error);
