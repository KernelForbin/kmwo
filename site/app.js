/* kmwo: calendar and check-offs. Runs once auth.js says we're signed in. */
(function () {
  "use strict";

  var P = window.KMWO_PLAN;
  var db = window.KMWO.db;
  var $ = function (id) { return document.getElementById(id); };

  var done = {};   // "YYYY-MM-DD" -> true
  var cells = [];  // every day in the plan

  function md(d) { return (d.getMonth() + 1) + "/" + d.getDate(); }
  function label(kind) { return kind === "lift" ? "Lift" : "Ride"; }

  function showError(text) {
    var e = $("err");
    e.textContent = text || "";
    e.hidden = !text;
  }

  function buildCells() {
    var start = P.parseDay(P.START);
    for (var w = 0; w < P.WEEKS; w++) {
      for (var d = 0; d < 7; d++) {
        var date = P.addDays(start, w * 7 + d);
        cells.push({ day: P.fmtDay(date), date: date, kind: P.SCHEDULE[d], week: w + 1, weekday: d });
      }
    }
  }

  function renderNext() {
    var today = P.fmtDay(new Date());
    var next = cells.find(function (c) { return c.kind && c.day >= today && !done[c.day]; });
    if (!next) {
      $("next-title").textContent = "All done";
      $("next-desc").textContent = "";
      return;
    }
    $("next-title").textContent = label(next.kind) + " · " + P.DAY_NAMES[next.weekday] + " " + md(next.date);
    $("next-desc").textContent = P.describe(next.kind, next.week);
  }

  function renderCalendar() {
    var today = P.fmtDay(new Date());
    var host = $("weeks");
    host.textContent = "";
    for (var w = 0; w < P.WEEKS; w++) {
      var row = document.createElement("div");
      row.className = "grid";
      cells.slice(w * 7, w * 7 + 7).forEach(function (c) {
        var isDone = !!done[c.day];
        var el = document.createElement(c.kind ? "button" : "div");
        el.className = "cell " + (c.kind || "off") + (isDone ? " done" : "") + (c.day === today ? " today" : "");
        var small = document.createElement("small");
        small.textContent = md(c.date);
        el.appendChild(small);
        if (c.kind) {
          var b = document.createElement("b");
          b.textContent = isDone ? "✓" : (c.kind === "lift" ? "L" : "R");
          el.appendChild(b);
          el.type = "button";
          el.title = P.describe(c.kind, c.week);
          el.addEventListener("click", function () { toggle(c); });
        }
        row.appendChild(el);
      });
      host.appendChild(row);
    }
    renderNext();
  }

  function toggle(c) {
    var was = !!done[c.day];
    if (was) delete done[c.day]; else done[c.day] = true;
    renderCalendar(); // optimistic
    db.from("sessions")
      .upsert({ day: c.day, kind: c.kind, done: !was }, { onConflict: "user_id,day" })
      .then(function (res) {
        if (res.error) { showError(res.error.message); load(); }
        else showError("");
      });
  }

  function load() {
    return db.from("sessions").select("day").eq("done", true).then(function (res) {
      if (res.error) { showError(res.error.message); return; }
      done = {};
      (res.data || []).forEach(function (r) { done[r.day] = true; });
      renderCalendar();
    });
  }

  window.KMWO.ready.then(function (session) {
    P.DAY_NAMES.forEach(function (n) {
      var s = document.createElement("span");
      s.textContent = n;
      $("dayhead").appendChild(s);
    });
    $("who").textContent = session.user.email || "";
    $("signout").addEventListener("click", function () { window.KMWO.signOut(); });
    buildCells();
    renderCalendar();
    $("app").hidden = false;
    load();
  });
})();
