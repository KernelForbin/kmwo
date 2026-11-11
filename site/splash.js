/* kmwo: short splash when the home-screen app opens.

   Loaded in <head> right after theme.js, so the splash covers the page from
   the first paint. Shows only when running as an installed app (opened from
   the home screen), once per launch, for about a second, then fades out.
   In a normal browser tab it never shows. Add ?splash to any URL to preview
   it in a browser. The look is in styles.css, "splash". */
(function () {
  "use strict";

  var KEY = "kmwo.splashed";
  var MIN_MS = 900;   // long enough to see, short enough not to annoy
  var FADE_MS = 300;  // matches the transition in styles.css

  var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;
  var forced = /[?&]splash\b/.test(location.search);

  var seen = false;
  try { seen = sessionStorage.getItem(KEY) === "1"; } catch (e) { /* no storage: show it */ }

  if (!forced && (!standalone || seen)) return;
  try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* fine */ }

  var root = document.documentElement;
  var start = Date.now();
  root.classList.add("splash");

  function hide() {
    var wait = Math.max(0, MIN_MS - (Date.now() - start));
    setTimeout(function () {
      root.classList.add("splash-out");
      setTimeout(function () { root.classList.remove("splash", "splash-out"); }, FADE_MS);
    }, wait);
  }

  if (document.readyState === "complete") hide();
  else window.addEventListener("load", hide);
  // Never trap the page behind the splash if "load" is slow (fonts, CDN).
  setTimeout(function () { if (root.classList.contains("splash")) hide(); }, 2500);
})();
