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

// TODO: this is not synced/tested right now
const markdownWriter = (write) => ({
  write: write,
  heading: (depth, kind, text) =>
    write(`${"#".repeat(depth)} ${text} (${kind})\n`),
  url: (name, href) => write(`[${name}](${href})`),
  addDoc: (doc) => write(`${doc}\n`),
  id: (id) => id.name,
  depth: 1,
});

export const markdownDump = (write, dumpModule) => (docs) => {
  const writer = markdownWriter(write);
  writer.write(markdownTemplate.start);
  dumpModule(writer)(docs);
  writer.write(markdownTemplate.end);
};
