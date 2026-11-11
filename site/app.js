/* kmwo: calendar and Next up. Tapping a day opens /day?d=... to log it. */
(function () {
  "use strict";

  var P = window.KMWO_PLAN;
  var K = window.KMWO;
  var $ = function (id) { return document.getElementById(id); };

  var logged = {}; // day -> { kind, done, short }

  function renderNext() {
    var doneDays = Object.keys(logged).filter(function (d) { return logged[d].done; });
    var n = P.nextUp(doneDays);
    var box = $("next");
    if (!n) {
      $("next-title").textContent = "All 24 done";
      $("next-desc").textContent = "If three a week feels automatic, add a fourth session (a Lift). Don't make sessions longer.";
      box.href = "/progress";
      return;
    }
    $("next-title").textContent = P.label(n.kind) + " · " + P.nice(n.day) + " · session " + n.number + " of " + P.TOTAL;
    $("next-desc").textContent = P.describe(n.kind, n.week) + ". 8:15 pm.";
    box.href = "/day?d=" + n.day;
  }

  function renderCalendar() {
    var t = P.today();
    var host = $("weeks");
    host.textContent = "";
    var start = P.parseDay(P.START);
    for (var w = 0; w < P.WEEKS; w++) {
      var row = document.createElement("div");
      row.className = "grid";
      for (var d = 0; d < 7; d++) {
        var day = P.fmtDay(P.addDays(start, w * 7 + d));
        var planned = P.plannedKind(day);
        var log = logged[day];
        var kind = log ? log.kind : planned;
        var isDone = !!(log && log.done);
        var missed = planned && !isDone && day < t;

        var el = document.createElement("a");
        el.href = "/day?d=" + day;
        el.className = "cell " + (kind || "off") + (isDone ? " done" : "") +
          (missed ? " missed" : "") + (day === t ? " today" : "");
        el.setAttribute("aria-label", P.nice(day) + (kind ? ", " + P.label(kind) : "") + (isDone ? ", done" : missed ? ", missed" : ""));

        var small = document.createElement("small");
        small.textContent = P.md(day);
        el.appendChild(small);
        if (kind) {
          var b = document.createElement("b");
          b.textContent = isDone ? "✓" : (kind === "lift" ? "L" : "R");
          el.appendChild(b);
          if (isDone && log.short) {
            var s = document.createElement("i");
            s.textContent = "10m";
            el.appendChild(s);
          }
        }
        row.appendChild(el);
      }
      host.appendChild(row);
    }
    renderNext();
  }

  function load() {
    return K.db.from("sessions").select("day, kind, done, short").then(function (res) {
      if (res.error) { K.showError(res.error.message); return; }
      logged = {};
      (res.data || []).forEach(function (r) { logged[r.day] = r; });
      renderCalendar();
    });
  }

  K.ready.then(function (session) {
    P.DAY_NAMES.forEach(function (n) {
      var s = document.createElement("span");
      s.textContent = n;
      $("dayhead").appendChild(s);
    });
    $("who").textContent = session.user.email || "";
    renderCalendar();
    load();
  });
})();
