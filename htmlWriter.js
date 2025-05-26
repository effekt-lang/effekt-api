// some sources contain the path to the node-installed library, so we need to extract only the relevant path!
const stripSource = (source) =>
  source ? source.replace(/.*(libraries\/.*\.effekt)$/, "$1") : "";

// TODO: the paths to the static files are wrong for nested effekt files
const htmlTemplate = (toc) => ({
  start: `<!DOCTYPE html>
  <html>
  <meta>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <link rel="stylesheet" href="module.css" type="text/css" charset="utf-8" />
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
    <script src="module.js" type="module" charset="utf-8"></script>
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
    heading: (depth, kind, text, signature, onlyToc) => {
      if (onlyToc) return;
      let out = "";
      if (depth > currentDepth) out += "<ul class=subtree>";
      if (depth < currentDepth) out += "</ul>".repeat(currentDepth - depth);
      currentDepth = depth;
      out += `<li class="heading ${kind}" title="${kind}">${text} <small class="signature">${htmlify(signature)}</small></li>`;
      write(out);
    },
    url: (name, href) => write(`<a href="${href}">${name}</a>`),
    addDoc: (doc) => {
      if (doc.trim() != "")
        write(
          `<div class="markdownWrap"><pre class="markdown doc">${doc}</pre></div>`,
        );
    },
    id: ({ name, source, origin }) => {
      const sourceId = `${source.lineStart}:${source.columnStart}-${source.lineEnd}:${source.columnEnd}`;
      // not every id has an origin!
      const originId =
        "lineStart" in origin
          ? `${origin.lineStart}:${origin.columnStart}-${origin.lineEnd}:${origin.columnEnd}`
          : "";
      return `<span class="id" data-sourceSource="${stripSource(source.file)}" data-source="${sourceId}" data-originSource="${stripSource(origin.file)}" data-origin="${originId}">${name}</span>`;
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
    addDoc: () => {},
    id: ({ name, source, origin }) => {
      const sourceId = `${source.lineStart}:${source.columnStart}-${source.lineEnd}:${source.columnEnd}`;
      // not every id has an origin!
      const originId =
        "lineStart" in origin
          ? `${origin.lineStart}:${origin.columnStart}-${origin.lineEnd}:${origin.columnEnd}`
          : "";
      return `<span class="id" data-sourceSource="${stripSource(source.file)}" data-source="${sourceId}" data-originSource="${stripSource(origin.file) || ""}" data-origin="${originId}">${name}</span>`;
    },
    depth: 1,
    currentDepth: () => currentDepth,
  };
};

const htmlDump = (write, dumpModule) => (docs) => {
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
};

// allows dumping multiple docs objs into a single template
const htmlDumpMultipleDispatch = (write, dumpModule) => {
  let toc = "";
  let content = "";
  const tocWriter = htmlTocWriter((text) => (toc += text));
  const writer = htmlWriter((text) => (content += text));

  const dispatch = (docs) => {
    // false value -> write!
    if (!docs) {
      toc += "</ul>".repeat(Math.max(tocWriter.currentDepth(), 0));
      const template = htmlTemplate(toc);
      write(template.start);
      write(content);
      write("</section>".repeat(Math.max(writer.currentDepth(), 0)));
      write(template.end);
      return;
    }

    // reset writer state
    tocWriter.depth = 1;
    writer.depth = 1;

    dumpModule(tocWriter)(docs);
    dumpModule(writer)(docs);

    return dispatch;
  };

  return dispatch;
};

module.exports = { htmlDump, htmlDumpMultipleDispatch };
