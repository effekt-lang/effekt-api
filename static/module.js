import { constructPosId, deconstructPosId, warn, openUrl } from "./util.js";
import { clearPopups, showPopupAt } from "./popup.js";
import {
  searchLibrary,
  findModule,
  searchDefinition,
  searchOrigins,
  loadLibrary,
} from "./search.js";

function jumpToModule(module) {
  window.location.assign(`/${module}.html`);
}

// TODO: we could instead also just parse the originSource attribute (see jumpToGithubOrigin)
function jumpToOrigin(definition, newTab) {
  const mod = findModule(definition);
  const { lineStart, columnStart, lineEnd, columnEnd } =
    definition.obj.id.origin;
  const name = `${definition.obj.id.name}@${lineStart}:${columnStart}-${lineEnd}:${columnEnd}`;
  const url = `${mod.obj.path}.html#${name}`;
  if (newTab) window.open(url, "_blank").focus();
  else {
    window.location.assign(url);
    scrollToUri(name, newTab);
  }
}

function jumpToGithubOrigin(el, newTab) {
  const originSource = el.getAttribute("data-originSource");
  const origin = el.getAttribute("data-origin");
  if (!origin) {
    warn("No origin!");
    return;
  }
  const { lineStart, lineEnd } = deconstructPosId(origin);
  const url = `https://github.com/effekt-lang/effekt/blob/master/${originSource}#L${lineStart}-L${lineEnd}`;
  openUrl(url, newTab);
}

function jumpToGithubSource(el, newTab) {
  const sourceSource = el.getAttribute("data-sourceSource");
  const source = el.getAttribute("data-source");
  if (!source) {
    warn("No source!");
    return;
  }
  const { lineStart, lineEnd } = deconstructPosId(source);
  const url = `https://github.com/effekt-lang/effekt/blob/master/${sourceSource}#L${lineStart}-L${lineEnd}`;
  openUrl(url, newTab);
}

function findGithubUses(text, newTab) {
  const url = `https://github.com/search?type=code&q=path%3A**%2F*.effekt+%22${text}%22`;
  openUrl(url, newTab);
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

function unhighlightAll() {
  document
    .querySelectorAll(".highlight")
    .forEach((el) => el.classList.remove("highlight"));
}

function lookupPopupAt(ev, element) {
  showPopupAt(ev, [
    {
      content: "Jump to origin (docs)",
      callback: ({ button }) => {
        const origins = searchOrigins(
          element.getAttribute("data-origin"),
          element.innerText,
        );
        if (origins.length === 0) warn("Couldn't find definition!");
        else jumpToOrigin(origins[0], button === 1);
      },
    },
    {
      content: "Jump to origin (GitHub)",
      callback: ({ button }) => jumpToGithubOrigin(element, button === 1),
    },
    {
      content: "Jump to source (GitHub)",
      callback: ({ button }) => jumpToGithubSource(element, button === 1),
    },
    {
      content: "Find uses (GitHub)",
      callback: ({ button }) => findGithubUses(element.innerText, button === 1),
    },
  ]);
}

function initializeModules() {
  document.querySelectorAll(".heading.Module").forEach((el) => {
    el.addEventListener("click", async (ev) => jumpToModule(el.innerText));
    el.addEventListener("mouseenter", () => el.classList.add("highlight"));
    el.addEventListener("mouseout", () => el.classList.remove("highlight"));
  });
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
      const origins = searchOrigins(
        el.getAttribute("data-origin"),
        el.innerText,
      );
      if (origins.length === 0) warn("Couldn't find definition!");
      else jumpToOrigin(origins[0]);
    });
  });
}

function initializeSearch() {
  const searchBar = document.querySelector("input#search");
  searchBar.addEventListener("input", () => {
    const toc = document.querySelector(".toc.tree");
    searchDefinition(toc, searchBar.value.toLowerCase());
    initializeHovering(toc);
    initializeTOC();
  });
}

// render all doc comments using marked.js
function initializeMarkdown() {
  document.querySelectorAll("div.markdownWrap").forEach((el) => {
    const inner = el.querySelector("pre.markdown");
    el.innerHTML = marked.parse(inner.textContent);
  });
}

// TODO: should we always do this?
loadLibrary();

if (window.location.hash) scrollToUri(window.location.hash);
window.onhashchange = () => scrollToUri(window.location.hash);

initializeModules();
initializeHovering(document);
initializeTOC();
initializeView();
initializeSearch();
initializeMarkdown();

document.body.addEventListener("click", clearPopups, true);
