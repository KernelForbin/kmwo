/* kmwo: home. Next up hero and the 8-week calendar; any day opens /day?d=... */
(function () {
  "use strict";

  var P = window.KMWO_PLAN;
  var K = window.KMWO;
  var $ = function (id) { return document.getElementById(id); };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var SVGNS = "http://www.w3.org/2000/svg";

  var logged = {}; // day -> { kind, done, short }

  function tick() {
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("class", "i tick");
    var p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", "M5 12.5l4.5 4.5L19 7.5");
    s.appendChild(p);
    return s;
  }

  function currentWeek() {
    var t = P.today();
    if (t < P.START) return 0;
    if (t > P.END) return P.WEEKS + 1;
    return P.weekOf(t);
  }

  function renderHeader() {
    var w = currentWeek();
    $("weeklabel").textContent = w === 0 ? "Starts Mon, Nov 16"
      : w > P.WEEKS ? "Plan complete" : "Week " + w + " of " + P.WEEKS;
  }

  function renderNext() {
    var doneDays = Object.keys(logged).filter(function (d) { return logged[d].done; });
    var doneCount = doneDays.filter(P.inPlan).length;
    var n = P.nextUp(doneDays);
    var box = $("next");
    $("next-meter").style.width = Math.min(100, doneCount / P.TOTAL * 100) + "%";
    if (!n) {
      box.className = "hero done";
      $("next-kind").textContent = "All 24 done";
      $("next-when").textContent = "Finished";
      $("next-desc").textContent = "If three a week feels automatic, add a fourth session (a Lift). Don't make sessions longer.";
      $("next-count").textContent = doneCount + " of " + P.TOTAL + " sessions";
      $("next-cta").textContent = "See progress →";
      box.href = "/progress";
      return;
    }
    box.className = "hero " + n.kind;
    $("next-kind").textContent = P.label(n.kind);
    $("next-when").textContent = P.nice(n.day) + " · 8:15 pm";
    $("next-desc").textContent = P.describe(n.kind, n.week);
    $("next-count").textContent = "Session " + n.number + " of " + P.TOTAL;
    $("next-cta").textContent = "Log it →";
    box.href = "/day?d=" + n.day;
  }

  function renderCalendar() {
    var t = P.today();
    var cw = currentWeek();
    var host = $("weeks");
    host.textContent = "";
    var start = P.parseDay(P.START);
    for (var w = 0; w < P.WEEKS; w++) {
      var wk = document.createElement("div");
      wk.className = "wk" + (cw === w + 1 ? " cur" : "");
      var ws = P.addDays(start, w * 7), we = P.addDays(start, w * 7 + 6);
      wk.textContent = "Week " + (w + 1) + "  ·  " + MONTHS[ws.getMonth()] + " " + ws.getDate() + " – " +
        (we.getMonth() !== ws.getMonth() ? MONTHS[we.getMonth()] + " " : "") + we.getDate();
      host.appendChild(wk);

      var row = document.createElement("div");
      row.className = "grid";
      for (var d = 0; d < 7; d++) {
        var date = P.addDays(start, w * 7 + d);
        var day = P.fmtDay(date);
        var planned = P.plannedKind(day);
        var log = logged[day];
        var kind = log ? log.kind : planned;
        var isDone = !!(log && log.done);
        var missed = planned && !isDone && day < t;

        var el = document.createElement("a");
        el.href = "/day?d=" + day;
        el.className = "cell " + (kind || "off") + (isDone ? " done" : "") +
          (missed ? " missed" : "") + (day < t ? " past" : "") + (day === t ? " today" : "");
        el.setAttribute("aria-label", P.nice(day) + (kind ? ", " + P.label(kind) : "") +
          (isDone ? ", done" : missed ? ", missed" : ""));

        var b = document.createElement("b");
        b.textContent = date.getDate();
        el.appendChild(b);
        if (isDone) {
          el.appendChild(tick());
          if (log.short) {
            var s = document.createElement("span");
            s.className = "short";
            s.textContent = "10m";
            el.appendChild(s);
          }
        } else {
          var dot = document.createElement("i");
          dot.className = "dot";
          el.appendChild(dot);
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

  K.ready.then(function () {
    P.DAY_NAMES.forEach(function (n) {
      var s = document.createElement("span");
      s.textContent = n.slice(0, 1) === "T" || n.slice(0, 1) === "S" ? n.slice(0, 2) : n.slice(0, 1);
      $("dayhead").appendChild(s);
    });
    renderHeader();
    renderCalendar();
    load();
  });
})();
