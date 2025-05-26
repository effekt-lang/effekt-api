class Writer {
  constructor(write) {
    this._write = write;
    this._currentDepth = { value: -1 };
    this.depth = 1;
  }

  /// abstract

  heading(depth, kind, text, onlyToc) {}

  url(name, href) {}

  addDoc(doc) {}

  id({ name, source, origin }) {}

  /// interface

  // overwritable write function
  write(content) {
    return this._write(content);
  }

  currentDepth() {
    return this._currentDepth.value;
  }

  // immutably, without currentDepth
  updateDepth(depth) {
    const copy = Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      this,
    );
    copy.depth = depth;
    return copy;
  }
}

module.exports = { Writer };
