const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", (event) => {
    let el = event.target;
    try {
      el = event.target.closest(
        "a,button,[role='button'],li,.lesson,.lecture,.course-item,.video-item"
      ) || event.target;
    } catch {}

    ipcRenderer.send("lesson-user-click", {
      text: String(
        el?.innerText ||
        el?.textContent ||
        el?.getAttribute?.("aria-label") ||
        ""
      ).trim().replace(/\s+/g, " ").slice(0, 220),
      href: String(el?.href || el?.closest?.("a")?.href || ""),
      tag: String(el?.tagName || "").toLowerCase()
    });
  }, true);
});
