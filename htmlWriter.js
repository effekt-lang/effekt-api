import { ROOT_PATH } from "./common.js";
import { Writer } from "./writer.js";

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
    <button id="tocToggle">≡</button>
    <ul class="toc tree">
      <li class="header">
        <a class="brand" href="${ROOT_PATH}">
          <img src="https://effekt-lang.org/img/light-navbar-brand.svg" alt="Effekt Logo" />
          <span>Effekt Library</span>
        </a>
        </div>
        <input class="search" type="search" spellcheck=false placeholder="Search" id="search"></input>
      </li>
      ${toc}
      <div class="searchResults"></div>
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

// TODO: we should abstract away the shared depth logic from here and tocWriter
class HtmlWriter extends Writer {
  heading(depth, kind, text, signature, onlyToc) {
    if (onlyToc) return;
    let out = "";
    if (depth > this.currentDepth()) out += "<ul class=subtree>";
    if (depth < this.currentDepth())
      out += "</ul>".repeat(this.currentDepth() - depth);
    this._currentDepth.value = depth;
    out += `<li class="heading ${kind}" title="${kind}">${text} <small class="signature">${htmlify(signature)}</small></li>`;
    this.write(out);
  }
  url(name, href) {
    this.write(`<a href="${href}">${name}</a>`);
  }
  addDoc(doc) {
    if (doc.trim() != "")
      this.write(
        `<div class="markdownWrap"><pre class="markdown doc">${doc}</pre></div>`,
      );
  }
  id({ name, source, origin }) {
    const sourceId = `${source.lineStart}:${source.columnStart}-${source.lineEnd}:${source.columnEnd}`;
    // not every id has an origin!
    const originId =
      "lineStart" in origin
        ? `${origin.lineStart}:${origin.columnStart}-${origin.lineEnd}:${origin.columnEnd}`
        : "";
    return `<span class="id" data-sourceSource="${stripSource(source.file)}" data-source="${sourceId}" data-originSource="${stripSource(origin.file)}" data-origin="${originId}">${name}</span>`;
  }
}

class HtmlTocWriter extends Writer {
  write() {} // toc is only written by heading/id
  heading(depth, kind, text) {
    let out = "";
    if (depth > this.currentDepth()) out += "<ul class=subtree>";
    if (depth < this.currentDepth())
      out += "</ul>".repeat(this.currentDepth() - depth);
    this._currentDepth.value = depth;
    out += `<li class="heading ${kind}">${text}</li>`;
    this._write(out);
  }
  id({ name, source, origin }) {
    const sourceId = `${source.lineStart}:${source.columnStart}-${source.lineEnd}:${source.columnEnd}`;
    // not every id has an origin!
    const originId =
      "lineStart" in origin
        ? `${origin.lineStart}:${origin.columnStart}-${origin.lineEnd}:${origin.columnEnd}`
        : "";
    return `<span class="id" data-sourceSource="${stripSource(source.file)}" data-source="${sourceId}" data-originSource="${stripSource(origin.file) || ""}" data-origin="${originId}">${name}</span>`;
  }
}

export const htmlDump = (write, dumpModule) => (docs) => {
  let toc = "";
  const tocWriter = new HtmlTocWriter((text) => (toc += text));
  dumpModule(tocWriter)(docs);
  toc += "</ul>".repeat(tocWriter.currentDepth());

  let content = "";
  const template = htmlTemplate(toc);
  const writer = new HtmlWriter((text) => (content += text));
  writer.write(template.start);
  dumpModule(writer)(docs);
  writer.write("</section>".repeat(writer.currentDepth()));
  writer.write(template.end);
  write(content);
};

// allows dumping multiple docs objs into a single template
export const htmlDumpMultipleDispatch = (write, dumpModule) => {
  let toc = "";
  let content = "";
  const tocWriter = new HtmlTocWriter((text) => (toc += text));
  const writer = new HtmlWriter((text) => (content += text));

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
