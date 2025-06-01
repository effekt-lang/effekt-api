export const ROOT_PATH = "/effect-api";
// export const ROOT_PATH = "/.";

export const stripSource = (source) =>
  source.replace(/.*(libraries\/.*\.effekt)$/, "$1");

export const moduleFile = (path) =>
  stripSource(path)
    .replace(/^libraries\//, "")
    .replace(/\.effekt$/, "");

export const moduleDir = (path) => {
  const file = moduleFile(path);
  return file.substring(0, file.lastIndexOf("/"));
};
