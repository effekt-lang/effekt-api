export function clearPopups() {
  document.querySelectorAll(".popup").forEach((el) => el.remove());
}

export function showPopupAt(ev, entries) {
  clearPopups();

  const ul = document.createElement("ul");
  entries.forEach(({ content, callback }) => {
    const li = document.createElement("li");
    li.innerHTML = content;
    li.addEventListener("click", (ev) => (clearPopups(), callback(ev)), {
      once: true,
    });
    li.addEventListener("auxclick", (ev) => (clearPopups(), callback(ev)), {
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
