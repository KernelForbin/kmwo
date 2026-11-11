/* kmwo: account menu. An initials button in the top right of every page
   (put <div class="account" id="account"></div> where it should go) that
   opens a menu with the signed-in account, Dark mode and Sign out.

   To add an item later, add an entry to ITEMS below:
     { label, icon (SVG path data), onClick }                    plain item
     { label, icon, checked: () -> bool, onToggle: (on) -> void } switch
     { label, icon, onClick, danger: true }                      red item */
(function () {
  "use strict";

  var K = window.KMWO;
  var T = window.KMWO_THEME;
  var host = document.getElementById("account");
  if (!host || !K) return;

  var ICONS = {
    moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
    out: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3",
    heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
  };

  var ITEMS = [
    { label: "Health sync", icon: ICONS.heart,
      onClick: function () { location.href = "/sync"; } },
    { label: "Dark mode", icon: ICONS.moon,
      checked: function () { return T ? T.isDark() : true; },
      onToggle: function (on) { if (T) T.set(on ? "dark" : "light"); } },
    { label: "Sign out", icon: ICONS.out, danger: true,
      onClick: function () { K.signOut(); } }
  ];

  function initials(name, email) {
    var src = (name || "").trim();
    if (src) {
      var parts = src.split(/\s+/);
      return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
    }
    return (email || "?").slice(0, 1).toUpperCase();
  }

  function svg(d) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("class", "i");
    s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(ns, "path");
    p.setAttribute("d", d);
    s.appendChild(p);
    return s;
  }

  function build(session) {
    var meta = session.user.user_metadata || {};
    var name = meta.full_name || meta.name || "";
    var email = session.user.email || "";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar";
    btn.textContent = initials(name, email);
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Account menu");

    var menu = document.createElement("div");
    menu.className = "menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;

    var head = document.createElement("div");
    head.className = "menu-head";
    var n = document.createElement("strong");
    n.textContent = name || "Signed in";
    var e = document.createElement("span");
    e.textContent = email;
    head.append(n, e);
    menu.appendChild(head);

    ITEMS.forEach(function (item) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "menu-item" + (item.danger ? " danger" : "");
      b.appendChild(svg(item.icon));
      var l = document.createElement("span");
      l.className = "grow";
      l.textContent = item.label;
      b.appendChild(l);
      if (item.onToggle) {
        b.setAttribute("role", "menuitemcheckbox");
        var sw = document.createElement("span");
        sw.className = "switch";
        sw.setAttribute("aria-hidden", "true");
        b.appendChild(sw);
        var sync = function () { b.setAttribute("aria-checked", item.checked() ? "true" : "false"); };
        sync();
        b.addEventListener("click", function () { item.onToggle(!item.checked()); sync(); });
        b._sync = sync;
      } else {
        b.setAttribute("role", "menuitem");
        b.addEventListener("click", function () { close(); item.onClick(); });
      }
      menu.appendChild(b);
    });

    function open() {
      menu.querySelectorAll(".menu-item").forEach(function (b) { if (b._sync) b._sync(); });
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      var first = menu.querySelector(".menu-item");
      if (first) first.focus({ preventScroll: true });
    }
    function close() {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }

    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (menu.hidden) open(); else close();
    });
    document.addEventListener("click", function (ev) {
      if (!menu.hidden && !host.contains(ev.target)) close();
    });
    document.addEventListener("keydown", function (ev) {
      if (menu.hidden) return;
      if (ev.key === "Escape") { close(); btn.focus(); return; }
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        var items = Array.prototype.slice.call(menu.querySelectorAll(".menu-item"));
        var i = items.indexOf(document.activeElement);
        var next = ev.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next].focus();
      }
    });

    host.textContent = "";
    host.append(btn, menu);
  }

  K.ready.then(build);
})();
