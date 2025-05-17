/// this generator is written in such a way that we could easily translate
/// it to Effekt code. `ctx` resembles an interface, where its functions are
/// effects that write the documentation (e.g. using htmlWriter)

const fs = require("node:fs");

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
  // ctx.startList();
  let res = "";

  if ("tparams" in term && term.tparams.length > 0) {
    // ctx.addPoint(`Type Parameters: \`${term.tparams.map(ctx.id).join(", ")}\``);
    res += `\`[${term.tparams.map(ctx.id).join(", ")}]\``;
  }

  if ("vparams" in term && term.vparams.length > 0) {
    // ctx.addPoint(
    //   `Value Parameters: ${term.vparams.map(({ id, tpe }) => `\`${ctx.id(id)}: ${showType(ctx)(tpe)}\``).join(", ")}`,
    // );
    res += ` \`(${term.vparams.map(({ id, tpe }) => `${ctx.id(id)}: ${showType(ctx)(tpe)}`).join(", ")})\``;
  }

  if ("bparams" in term && term.bparams.length > 0) {
    // ctx.addPoint(
    //   `Block Parameters: ${term.bparams.map(({ id, tpe }) => `\`{ ${ctx.id(id)}: ${showType(ctx)(tpe)} }\``).join(", ")}`,
    // );
    res += ` ${term.bparams.map(({ id, tpe }) => `\`{ ${ctx.id(id)}: ${showType(ctx)(tpe)} }\``).join(", ")}`;
  }

  if ("ret" in term && term.ret.kind === "Effectful") {
    // ctx.addPoint(
    //   `Return: \`${showType(ctx)(term.ret.tpe)} / {${term.ret.eff.map(showType(ctx)).join(", ")}}\``,
    // );
    res += `: \`${showType(ctx)(term.ret.tpe)} / {${term.ret.eff.map(showType(ctx)).join(", ")}}\` `;
  }

  return res;
};

const dumpFields = (ctx) => (term) => {
  const go = (fields) => {
    fields.forEach((field) => {
      ctx.heading(
        ctx.depth + 1,
        field.kind,
        ctx.id(field.id),
        showSignature(ctx)(field),
      );
      // dumpSignature(ctx)(field);
      dumpDoc(ctx)(field.doc);
    });
  };

  if ("ops" in term) go(term.ops);
  if ("ctors" in term) go(term.ctors);
};

const dumpDefinitions = (ctx) => (term) => {
  if ("definitions" in term)
    term.definitions.forEach(dumpDefinition({ ...ctx, depth: ctx.depth + 1 }));
};

const dumpDefinition = (ctx) => (term) => {
  ctx.heading(ctx.depth, term.kind, ctx.id(term.id), showSignature(ctx)(term));
  dumpDoc(ctx)(term.doc);
  dumpDefinitions(ctx)(term);
  dumpFields(ctx)(term);
};

const dumpModule = (ctx) => (obj) => {
  console.assert(obj.module.kind === "ModuleDecl");
  ctx.heading(ctx.depth, "Module", obj.module.path);
  ctx.write("Jump to source: ");
  ctx.url(
    obj.source,
    `https://github.com/effekt-lang/effekt/tree/master/${obj.source}`,
  );
  ctx.write("<br>Example usage: ");
  ctx.url(
    `examples/stdlib/${obj.module.path}`,
    `https://github.com/effekt-lang/effekt/tree/master/examples/stdlib/${obj.module.path}`,
  );
  dumpDoc(ctx)(obj.module.doc); // TODO
  obj.module.defs.forEach(dumpDefinition({ ...ctx, depth: ctx.depth + 1 }));
};

const markdownTemplate = {
  start: `---
title: Effekt Documentation
author: Effekt Authors
geometry: margin=1in
papersize: a4
toc: yes
header-includes: |
    \\usepackage{fancyhdr}
    \\pagestyle{fancy}
    \\fancyhead[CO,CE]{Effekt Documentation}
---

`,
  end: "",
};

const markdownWriter = (write) => ({
  write: write,
  heading: (depth, kind, text) =>
    write(`${"#".repeat(depth)} ${text} (${kind})\n`),
  url: (name, href) => write(`[${name}](${href})`),
  addPoint: (text) => write(`- ${text}\n`),
  addDoc: (doc) => write(`${doc}\n`),
  startList: () => write("\n"),
  endList: () => write("\n"),
  id: (id) => id.name,
  depth: 1,
});

const htmlTemplate = (toc) => ({
  start: `<!DOCTYPE html>
  <html>
  <meta>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <link rel="stylesheet" href="/module.css" type="text/css" charset="utf-8" />
  </meta>
  <body>
    <main>
    <ul class="toc tree">
      <li class="header">
        <div class="brand">
          <img src="https://effekt-lang.org/img/light-navbar-brand.svg" alt="Effekt Logo" />
          <span>Effekt Library</span>
        </div>
        <input class="search" type="search" spellcheck=false placeholder="Search" id="search"></input>
      </li>
      ${toc}
      <li class="searchResults"></li>
    </ul>
    <ul class="view tree">
  `,
  end: `
    </ul>
    </main>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="/module.js" type="module" charset="utf-8"></script>
  </body></html>`,
});

const htmlify = (text) => {
  if (!text) return "";
  else return text.replace(/`([^`]+)`/g, '<code class="inline">$1</code>');
};

const htmlWriter = (write) => {
  let currentDepth = -1;
  return {
    write,
    heading: (depth, kind, text, signature) => {
      let out = "";
      if (depth > currentDepth) out += "<ul class=subtree>";
      if (depth < currentDepth) out += "</ul>".repeat(currentDepth - depth);
      currentDepth = depth;
      out += `<li class="heading ${kind}" title="${kind}">${text} <small class="signature">${htmlify(signature)}</small></li>`;
      write(out);
    },
    url: (name, href) => write(`<a href="${href}">${name}</a>`),
    addPoint: (text) => write(`<li>${htmlify(text)}\n</li>`),
    addDoc: (doc) => {
      if (doc.trim() != "")
        write(
          `<div class="markdownWrap"><pre class="markdown doc">${doc}</pre></div>`,
        );
    },
    startList: () => write("<ul>"),
    endList: () => write("</ul>"),
    id: ({ name, source, origin }) => {
      const sourceId = `${source.lineStart}:${source.columnStart}-${source.lineEnd}:${source.columnEnd}`;
      // not every id has an origin!
      const originId =
        "lineStart" in origin
          ? `${origin.lineStart}:${origin.columnStart}-${origin.lineEnd}:${origin.columnEnd}`
          : "";
      return `<span class="id" data-sourceSource="${source.file}" data-source="${sourceId}" data-originSource="${origin.file || ""}" data-origin="${originId}">${name}</span>`;
    },
    depth: 1,
    currentDepth: () => currentDepth,
  };
};

const htmlTocWriter = (write) => {
  let currentDepth = -1;
  return {
    write: () => {},
    heading: (depth, kind, text) => {
      let out = "";
      if (depth > currentDepth) out += "<ul class=subtree>";
      if (depth < currentDepth) out += "</ul>".repeat(currentDepth - depth);
      currentDepth = depth;
      out += `<li class="heading ${kind}">${text}</li>`;
      write(out);
    },
    url: () => {},
    addPoint: () => {},
    addDoc: () => {},
    startList: () => {},
    endList: () => {},
    id: ({ name, source, origin }) => {
      const sourceId = `${source.lineStart}:${source.columnStart}-${source.lineEnd}:${source.columnEnd}`;
      // not every id has an origin!
      const originId =
        "lineStart" in origin
          ? `${origin.lineStart}:${origin.columnStart}-${origin.lineEnd}:${origin.columnEnd}`
          : "";
      return `<span class="id" data-sourceSource="${source.file}" data-source="${sourceId}" data-originSource="${origin.file || ""}" data-origin="${originId}">${name}</span>`;
    },
    depth: 1,
    currentDepth: () => currentDepth,
  };
};

const allInOne = (docs, template, writer) => {
  writer.write(template.start);
  docs.forEach(dumpModule(writer));
  writer.write(template.end);
};

// fs.readFile("data/full.json", "utf8", (err, data) => {
//   // fs.readFile("data/test.effekt.json", "utf8", (err, data) => {
//   const docs = JSON.parse(data);
//   const write = console.log;
//   // markdown:
//   // allInOne(docs, markdownTemplate, markdownWriter(write))
// });

async function dumpAll(data, out) {
  const dir = await fs.promises.opendir(data);

  for await (const dirent of dir) {
    console.log(dirent.name);
    fs.readFile(`${data}/${dirent.name}`, "utf8", (err, data) => {
      const name = dirent.name.replace(/\..*$/, "");
      const outName = `${out}/${name}.html`;
      fs.writeFileSync(outName, ""); // create/clear
      const write = (text) => fs.appendFileSync(outName, text);

      const docs = JSON.parse(data);

      let toc = "";
      const tocWriter = htmlTocWriter((text) => (toc += text));
      dumpModule(tocWriter)(docs);
      toc += "</ul>".repeat(tocWriter.currentDepth());

      let content = "";
      const template = htmlTemplate(toc);
      const writer = htmlWriter((text) => (content += text));
      writer.write(template.start);
      dumpModule(writer)(docs);
      writer.write("</section>".repeat(writer.currentDepth()));
      writer.write(template.end);
      write(content);
    });
  }
}

dumpAll("data", "build").catch(console.error);
