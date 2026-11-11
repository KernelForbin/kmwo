/* kmwo: light/dark theme. Loaded in <head>, before the stylesheet paints, so
   a saved choice applies with no flash of the wrong theme.

   No saved choice: follow the system setting (styles.css handles that).
   Saved choice ("light" or "dark" in localStorage): set data-theme on <html>.

   Exposes window.KMWO_THEME:
     isDark   () -> bool, the theme in effect now
     set      ("light" | "dark") saves and applies the choice */
(function () {
  "use strict";

  var KEY = "kmwo.theme";
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  function saved() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : null;
    } catch (e) {
      return null;
    }
  }

  function isDark() {
    var t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return !(mq && mq.matches);
  }

  function syncMeta() {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", isDark() ? "#0b0d10" : "#f3f4f7");
  }

  function apply(theme) {
    if (theme) root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
    syncMeta();
  }

  function set(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode: applies for this page only */ }
    apply(theme);
  }

  apply(saved());
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { if (!saved()) syncMeta(); });
  document.addEventListener("DOMContentLoaded", syncMeta);

  window.KMWO_THEME = { isDark: isDark, set: set };
})();
