let entireLibrary = [];

// search by filter in library, building an inversed tree with breadcrumbs
function searchLibrary(filter) {
  function go(obj, path) {
    if (typeof obj === "array") {
      const res = obj.map((el, i) => go(el, [i, ...path]));
      if (res.find((el) => el.found))
        return {
          found: true,
          data: (parent) => res.flatMap((r) => r.data({ obj, path, parent })),
        };
    }

    if (typeof obj === "object") {
      if ("id" in obj && filter(obj))
        return {
          found: true,
          data: (parent) => [{ obj, path, parent }],
        };

      const res = Object.entries(obj)
        .map(([key, el]) => go(el, [key, ...path]))
        .filter((el) => el.found);
      if (res.find((el) => el.found))
        return {
          found: true,
          data: (parent) => res.flatMap((r) => r.data({ obj, path, parent })),
        };
    }

    return { found: false };
  }

  const res = go(entireLibrary, []);
  if (res.found) return res.data({});
  return [];
}

// TODO: this shouldn't be hardcoded
function isDefinition(kind) {
  return [
    "FunDef",
    "ValDef",
    "RegDef",
    "VarDef",
    "DefDef",
    "NamespaceDef",
    "InterfaceDef",
    "DataDef",
    "RecordDef",
    "TypeDef",
    "EffectDef",
    "ExternType",
    "ExternDef",
    "ExternResource",
    "ExternInterface",
    "ExternInclude",
  ].includes(kind);
}

function findModule(definition) {
  let it = definition;
  while ("obj" in it && it.obj.kind !== "ModuleDecl") it = it.parent;
  if (!("obj" in it)) alert("FATAL: definition not in module!");
  return it;
}

function jumpToOrigin(definition) {
  const mod = findModule(definition);
  const { lineStart, columnStart, lineEnd, columnEnd } =
    definition.obj.id.origin;
  const name = `${definition.obj.id.name}@${lineStart}:${columnStart}-${lineEnd}:${columnEnd}`;
  const url = `${mod.obj.path}.html#${name}`;
  // window.location.href = url;
  window.location.assign(url);
  scrollToUri(name);
}

function jumpToSource(el) {
  const sourceSource = el.getAttribute("data-sourceSource");
  const source = el.getAttribute("data-source");
  const { lineStart, lineEnd } = deconstructPosId(source);
  const url = `https://github.com/effekt-lang/effekt/blob/master/${sourceSource}#L${lineStart}-L${lineEnd}`;
  window.location.href = url;
}

function scrollToUri(uri) {
  if (uri.length === 0) return;

  const [name, id] = uri.split("@");
  const element = document.querySelector(
    `.view .heading .id[data-origin="${id}"]`,
  );
  if (!element) return;

  element.scrollIntoView();
  element.classList.add("highlight");
}

function constructPosId(span) {
  return `${span.lineStart}:${span.columnStart}-${span.lineEnd}:${span.columnEnd}`;
}

function deconstructPosId(pos) {
  const [from, to] = pos.split("-");
  const [lineStart, columnStart] = from.split(":");
  const [lineEnd, columnEnd] = to.split(":");
  return { lineStart, columnStart, lineEnd, columnEnd };
}

function equalOrigin(id, origin) {
  if (!origin) return false;
  const { lineStart, columnStart, lineEnd, columnEnd } =
    deconstructPosId(origin);
  return (
    id.origin.lineStart == lineStart &&
    id.origin.columnStart == columnStart &&
    id.origin.lineEnd == lineEnd &&
    id.origin.columnEnd == columnEnd
  );
}

function unhighlightAll() {
  document
    .querySelectorAll(".highlight")
    .forEach((el) => el.classList.remove("highlight"));
}

function generateDefinitionItem({
  obj: {
    kind,
    id: { name, source, origin },
  },
}) {
  return `<li class="heading ${kind}">
           <span class="id" data-sourcesource="${source.file}" data-source="${constructPosId(source)}" data-originsource="${origin.file}" data-origin="${constructPosId(origin)}">
             ${name}
           </span>
         </li>`;
}

function searchDefinition(input) {
  /// search in current module

  // hide current toc
  const toc = document.querySelector(".toc.tree");
  const child = toc.querySelector(".subtree");
  child.style.display = "none";

  // remove previous search results
  toc.querySelectorAll(".searchResults *").forEach((el) => el.remove());

  // search by name
  const results = searchLibrary(
    ({ id, kind }) =>
      id.name && id.name.startsWith(input) && isDefinition(kind),
  );
  // TODO: filter by breadcrumb path

  console.log(results);
  const resultHTML = results.map(generateDefinitionItem).join("");

  toc.querySelector(".searchResults").innerHTML =
    `<ul class="subtree">${resultHTML}</ul>`;
  registerIdentifierListeners(toc);
}

function registerIdentifierListeners(dom) {
  dom.querySelectorAll("span.id").forEach((el1) => {
    const origin = el1.getAttribute("data-origin");

    // interconnected listeners for hovering
    // TODO: we should also compare by name, e.g. in Exception
    el1.addEventListener("mouseenter", () => {
      if (origin == "") return;
      unhighlightAll();
      el1.classList.add("highlight");
      dom
        .querySelectorAll(`span.id[data-origin="${origin}"]`)
        .forEach((el2) => {
          el2.classList.add("highlight");
        });
    });
    el1.addEventListener("mouseout", () => {
      if (origin == "") return;
      el1.classList.remove("highlight");
      dom
        .querySelectorAll(`span.id[data-origin="${origin}"]`)
        .forEach((el2) => {
          el2.classList.remove("highlight");
        });
    });

    // click
    el1.addEventListener("click", async () => {
      const results = searchLibrary(
        ({ id, kind }) =>
          id.name === el1.innerText &&
          isDefinition(kind) &&
          equalOrigin(id, origin),
      );

      if (results.length > 1) console.warn("Found multiple definitions!");
      if (results.length === 0) console.warn("Couldn't find definition!");
      if (results.length === 1) jumpToOrigin(results[0]);
    });

    // right click
    el1.addEventListener("contextmenu", async (ev) => {
      ev.preventDefault();
      jumpToSource(el1);
    });
  });
}

async function loadLibrary() {
  const library = await fetch("/full.json");
  if (!library.ok) throw new Error("Missing library");

  entireLibrary = await library.json();
}

// TODO: should we always do this?
loadLibrary();
if (window.location.hash) scrollToUri(window.location.hash);
window.onhashchange = () => scrollToUri(window.location.hash);

// render all doc comments using marked.js
document.querySelectorAll("div.markdownWrap").forEach((el) => {
  const inner = el.querySelector("pre.markdown");
  el.innerHTML = marked.parse(inner.textContent);
});

registerIdentifierListeners(document);

const searchBar = document.querySelector("input#search");
searchBar.addEventListener("input", () => searchDefinition(searchBar.value));
