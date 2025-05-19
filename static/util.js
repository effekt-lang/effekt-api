export function constructPosId(span) {
  return `${span.lineStart}:${span.columnStart}-${span.lineEnd}:${span.columnEnd}`;
}

export function deconstructPosId(pos) {
  const [from, to] = pos.split("-");
  const [lineStart, columnStart] = from.split(":");
  const [lineEnd, columnEnd] = to.split(":");
  return { lineStart, columnStart, lineEnd, columnEnd };
}

export function warn(text) {
  console.warn(text);
  document.body.style.cursor = "not-allowed";
  setTimeout(() => (document.body.style.cursor = "auto"), 1000);
}

export function openUrl(url, newTab) {
  if (newTab) window.open(url, "_blank").focus();
  else window.location.href = url;
}
