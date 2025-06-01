import { Writer } from "./writer.js";

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
class MarkdownWriter extends Writer {
  heading(depth, kind, text) {
    this.write(`${"#".repeat(depth)} ${text} (${kind})\n`);
  }
  url(name, href) {
    this.write(`[${name}](${href})`);
  }
  addDoc(doc) {
    this.write(`${doc}\n`);
  }
  id({ name }) {
    return name;
  }
}

export const markdownDump = (write, dumpModule) => (docs) => {
  const writer = new MarkdownWriter(write);
  writer.write(markdownTemplate.start);
  dumpModule(writer)(docs);
  writer.write(markdownTemplate.end);
};
