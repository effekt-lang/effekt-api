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

// some sources contain the path to the node-installed library, so we need to extract only the relevant path!
function stripSource(source) {
  return source.replace(/.*(libraries\/.*\.effekt)$/, "$1");
}

// TODO: we could instead also just parse the originSource attribute (see jumpToGithubOrigin)
function jumpToOrigin(definition) {
  const mod = findModule(definition);
  const { lineStart, columnStart, lineEnd, columnEnd } =
    definition.obj.id.origin;
  const name = `${definition.obj.id.name}@${lineStart}:${columnStart}-${lineEnd}:${columnEnd}`;
  const url = `${mod.obj.path}.html#${name}`;
  window.location.assign(url);
  scrollToUri(name);
}

function jumpToGithubOrigin(el) {
  const originSource = el.getAttribute("data-originSource");
  const origin = el.getAttribute("data-origin");
  if (!origin) {
    warn("No origin!");
    return;
  }
  const { lineStart, lineEnd } = deconstructPosId(origin);
  const url = `https://github.com/effekt-lang/effekt/blob/master/${stripSource(originSource)}#L${lineStart}-L${lineEnd}`;
  window.location.href = url;
}

function jumpToGithubSource(el) {
  const sourceSource = el.getAttribute("data-sourceSource");
  const source = el.getAttribute("data-source");
  if (!source) {
    warn("No source!");
    return;
  }
  const { lineStart, lineEnd } = deconstructPosId(source);
  const url = `https://github.com/effekt-lang/effekt/blob/master/${stripSource(sourceSource)}#L${lineStart}-L${lineEnd}`;
  window.location.href = url;
}

function findGithubUses(text) {
  const url = `https://github.com/search?type=code&q=path%3A**%2F*.effekt+%22${text}%22`;
  window.location.href = url;
}

function scrollToUri(uri) {
  if (uri.length === 0) return;

  // nodes with this exact origin URI are not necessarily the definitions, but could also be uses!
  // therefore we jump to the first term with this origin that's a direct descendant of a heading
  // (i.e. not a simple usage, but a definition)
  const [name, id] = uri.split("@");
  const element = document.querySelector(
    `.view .heading > .id[data-origin="${id}"]`,
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

function generateDefinitionItem(definition) {
  const defId = definition.obj.id;
  return `
    <li class="heading ${definition.obj.kind}">
      <span class="id" data-sourcesource="${defId.source.file}" data-source="${constructPosId(defId.source)}" data-originsource="${defId.origin.file}" data-origin="${constructPosId(defId.origin)}">
        ${defId.name}
      </span>
    </li>`;
}

function searchDefinition(input) {
  const toc = document.querySelector(".toc.tree");
  const child = toc.querySelector(".subtree");

  // remove previous search results
  toc.querySelectorAll(".searchResults *").forEach((el) => el.remove());

  if (input == "") {
    child.style.display = "inherit";
    return;
  }

  // hide current toc
  child.style.display = "none";

  // search by name
  // TODO: do we only want to search by isDefinition? We could also include args, types, etc.
  const results = searchLibrary(
    ({ id, kind }) =>
      id.name && id.name.toLowerCase().startsWith(input) && isDefinition(kind),
  );

  // group results by module
  const modules = {};
  results.forEach((result) => {
    const module = findModule(result);
    if (module.obj.path in modules)
      modules[module.obj.path].results.push(result);
    else modules[module.obj.path] = { module, results: [result] };
  });

  // concatenate html of all modules with the concatenated definitions
  const moduleHTML = Object.entries(modules)
    .map(([path, value]) => {
      const resultHTML = value.results.map(generateDefinitionItem).join("");
      const mod = value.module.obj;
      return `
      <li class="heading Module">
        <span class="id" data-sourcesource="${mod.span.file}" data-source="${constructPosId(mod.span)}" data-originsource="${mod.span.file}" data-origin="${constructPosId(mod.span)}">
          ${mod.path}
        </span>
        <ul class="subtree">
          ${resultHTML}
        </ul>
      </li>`;
    })
    .join("");

  toc.querySelector(".searchResults").innerHTML =
    `<ul class="subtree">${moduleHTML}</ul>`;
  initializeHovering(toc);
  initializeTOC();
}

function clearPopups() {
  document.querySelectorAll(".popup").forEach((el) => el.remove());
}

function showPopupAt(ev, entries) {
  clearPopups();

  const ul = document.createElement("ul");
  entries.forEach(({ content, callback }) => {
    const li = document.createElement("li");
    li.innerHTML = content;
    li.addEventListener("click", (ev) => (clearPopups(), callback(ev)), {
      once: true,
    });
    ul.appendChild(li);
  });

  const popup = document.createElement("div");
  popup.className = "popup";
  const content = document.createElement("div");
  popup.style.left = ev.pageX + "px";
  popup.style.top = ev.pageY + "px";
  popup.style.cursor = "pointer";
  popup.appendChild(ul);
  document.body.appendChild(popup);
}

function findOrigins(origin, name) {
  const results = searchLibrary(
    ({ id, kind }) =>
      id.name === name && isDefinition(kind) && equalOrigin(id, origin),
  );
  return results;
}

function lookupPopupAt(ev, element) {
  showPopupAt(ev, [
    {
      content: "Jump to origin (docs)",
      callback: () => {
        const origins = findOrigins(
          element.getAttribute("data-origin"),
          element.innerText,
        );
        if (origins.length === 0) warn("Couldn't find definition!");
        else jumpToOrigin(origins[0]);
      },
    },
    {
      content: "Jump to origin (GitHub)",
      callback: () => jumpToGithubOrigin(element),
    },
    {
      content: "Jump to source (GitHub)",
      callback: () => jumpToGithubSource(element),
    },
    {
      content: "Find uses (GitHub)",
      callback: () => findGithubUses(element.innerText),
    },
  ]);
}

function initializeHovering(dom) {
  dom.querySelectorAll("span.id").forEach((el1) => {
    const origin = el1.getAttribute("data-origin");

    // interconnected listeners
    el1.addEventListener("mouseenter", () => {
      unhighlightAll();
      el1.classList.add("highlight");
      if (origin == "") return;
      dom
        .querySelectorAll(`span.id[data-origin="${origin}"]`)
        .forEach((el2) => {
          el2.classList.add("highlight");
        });
    });
    el1.addEventListener("mouseout", () => {
      el1.classList.remove("highlight");
      if (origin == "") return;
      dom
        .querySelectorAll(`span.id[data-origin="${origin}"]`)
        .forEach((el2) => {
          el2.classList.remove("highlight");
        });
    });
  });
}

function warn(text) {
  console.warn(text);
  document.body.style.cursor = "not-allowed";
  setTimeout(() => (document.body.style.cursor = "auto"), 1000);
}

function initializeView() {
  document.querySelectorAll(".view.tree span.id").forEach((el) => {
    el.addEventListener("click", async (ev) => {
      lookupPopupAt(ev, el);
    });
  });
}

function initializeTOC() {
  document.querySelectorAll(".toc.tree span.id").forEach((el) => {
    el.addEventListener("click", () => {
      const origins = findOrigins(el.getAttribute("data-origin"), el.innerText);
      if (origins.length === 0) warn("Couldn't find definition!");
      else jumpToOrigin(origins[0]);
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

document.body.addEventListener("click", clearPopups, true);

initializeHovering(document);
initializeTOC();
initializeView();

const searchBar = document.querySelector("input#search");
searchBar.addEventListener("input", () =>
  searchDefinition(searchBar.value.toLowerCase()),
);
