import { constructPosId, deconstructPosId } from "./util.js";
import { ROOT_PATH, moduleFile } from "./common.js";

let entireLibrary = [];

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

// search by filter in library, building an inversed tree with breadcrumbs
export function searchLibrary(filter) {
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

export function findModule(definition) {
  let it = definition;
  while ("obj" in it && it.obj.kind !== "ModuleDecl") it = it.parent;
  if (!("obj" in it)) alert("FATAL: definition not in module!");
  return it;
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

function generateDefinitionItem(definition) {
  const defId = definition.obj.id;
  return `
    <li class="heading ${definition.obj.kind}">
      <span class="id" data-sourcesource="${defId.source.file}" data-source="${constructPosId(defId.source)}" data-originsource="${defId.origin.file}" data-origin="${constructPosId(defId.origin)}">
        ${defId.name}
      </span>
    </li>`;
}

function levenshtein(s, t) {
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const arr = [];
  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] =
        i === 0
          ? j
          : Math.min(
              arr[i - 1][j] + 1,
              arr[i][j - 1] + 1,
              arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1),
            );
    }
  }
  const dist = arr[t.length][s.length];

  // convert to percentage
  return 1 - dist / Math.max(s.length, t.length);
}

export function searchDefinition(toc, input) {
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
    ({ id, kind, doc }) =>
      ((id.name &&
        (id.name.toLowerCase().includes(input) ||
          levenshtein(id.name.toLowerCase(), input) > 0.7)) ||
        (doc && doc.toLowerCase().includes(input))) &&
      isDefinition(kind),
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
        <a class="moduleLink" href="${ROOT_PATH}/${moduleFile(mod.span.file)}.html">${mod.path}</a>
      </li>
      <ul class="subtree">
        ${resultHTML}
      </ul>`;
    })
    .join("");

  toc.querySelector(".searchResults").innerHTML =
    `<ul class="subtree">${moduleHTML}</ul>`;
}

export function searchOrigins(origin, name) {
  const results = searchLibrary(
    ({ id, kind }) =>
      id.name === name && isDefinition(kind) && equalOrigin(id, origin),
  );
  return results;
}

export async function loadLibrary() {
  const response = await fetch(`${ROOT_PATH}/full.json.gz`);
  if (!response.ok) throw new Error("Missing library");

  if (typeof DecompressionStream === "undefined")
    throw new Error("DecompressionStream is not supported");

  const ds = new DecompressionStream("gzip");
  const decompressedStream = response.body.pipeThrough(ds);
  const textStream = decompressedStream.pipeThrough(new TextDecoderStream());
  const reader = textStream.getReader();

  let result = "";
  let { value, done } = await reader.read();
  while (!done) {
    result += value;
    ({ value, done } = await reader.read());
  }

  entireLibrary = JSON.parse(result);
}
