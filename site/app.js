/* kmwo: home. Next up hero, a Today strip, and a month calendar (‹ › or
   swipe, back to Jan 2026) with plan sessions, extras and daily steps.
   Any day opens /day?d=... */
(function () {
  "use strict";

  var P = window.KMWO_PLAN;
  var K = window.KMWO;
  var $ = function (id) { return document.getElementById(id); };
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var SVGNS = "http://www.w3.org/2000/svg";
  var FIRST_MONTH = "2026-01";

  var logged = {}; // day -> { kind, done, short }
  var extras = {}; // day -> [other workout names]
  var daily = {};  // day -> { steps, body_weight }
  var shown = null; // "YYYY-MM" on screen

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
    $("weeklabel").textContent = w === 0 ? "Starts " + P.nice(P.START)
      : w > P.WEEKS ? "Plan complete" : "Week " + w + " of " + P.WEEKS;
  }

  function skipIcon() {
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("class", "i skipx");
    var p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", "M6 6l12 12M18 6L6 18");
    s.appendChild(p);
    return s;
  }

  function doneDays() { return Object.keys(logged).filter(function (d) { return logged[d].done; }); }
  function skippedDays() { return Object.keys(logged).filter(function (d) { return logged[d].done === false; }); }

  /* One tap under the hero: mark the next planned day (or, if you're behind,
     the latest missed one) as skipped. Undo puts it back. */
  var undoDay = null;
  function renderSkip() {
    var btn = $("skip"), msg = $("skip-msg");
    if (undoDay) {
      var nm = P.nice(undoDay);
      msg.textContent = "Skipped " + (nm === "Today" || nm === "Tomorrow" ? nm.toLowerCase() : nm) + ".";
      btn.textContent = "Undo";
      btn.hidden = false;
      return;
    }
    var target = P.skipTarget(doneDays(), skippedDays());
    msg.textContent = "";
    btn.hidden = !target;
    if (target) {
      btn.textContent = (target < P.today() ? "Mark " + P.nice(target) + " skipped"
        : "Skip " + (P.nice(target) === "Today" ? "today" : P.nice(target)));
      btn.dataset.day = target;
    }
  }
  function onSkip() {
    var btn = $("skip");
    btn.disabled = true;
    K.showError("");
    var op;
    if (undoDay) {
      var d = undoDay;
      op = K.db.from("sessions").delete().eq("day", d).eq("done", false)
        .then(function (r) { if (r.error) throw r.error; delete logged[d]; undoDay = null; });
    } else {
      var day = btn.dataset.day;
      var row = { day: day, kind: P.plannedKind(day) || "ride", done: false, short: false };
      op = K.db.from("sessions").upsert(row, { onConflict: "user_id,day" })
        .then(function (r) { if (r.error) throw r.error; logged[day] = row; undoDay = day; });
    }
    op.then(render, function (e) { K.showError(e.message || String(e)); })
      .then(function () { btn.disabled = false; });
  }

  function renderNext() {
    var done = doneDays();
    var doneCount = done.filter(P.inPlan).length;
    var n = P.nextUp(done, skippedDays());
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
    box.href = "/day?d=" + n.day + "&k=" + n.kind;
  }

  // Today's plan session as a chip: done (with minutes), skipped, or still to do.
  function sessionChip(t) {
    var log = logged[t];
    var kind = log ? log.kind : P.plannedKind(t);
    if (!kind) return null;
    var name = P.label(kind);
    if (log && log.done) {
      var extra = log.short ? " · 10 min" : (kind === "ride" && log.ride_minutes ? " · " + log.ride_minutes + " min" : "");
      return { cls: kind, set: true, done: true, href: "/day?d=" + t, text: name + extra };
    }
    if (log) return { cls: "skipped", set: true, href: "/day?d=" + t, text: name + " skipped" };
    return { cls: kind, set: false, href: "/day?d=" + t + "&k=" + kind, text: name };
  }

  // Today strip: the plan session, steps, weight and other workouts for
  // today, each a quick add.
  function renderToday() {
    var t = P.today();
    var d = daily[t] || {};
    var acts = extras[t] || [];
    var host = $("today");
    host.textContent = "";
    var sc = sessionChip(t);
    if (sc) {
      var a0 = document.createElement("a");
      a0.className = "chip session " + sc.cls + (sc.set ? " set" : " add");
      a0.href = sc.href;
      if (sc.done) a0.appendChild(tick());
      else if (!sc.set) a0.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
      a0.appendChild(document.createTextNode(sc.text));
      host.appendChild(a0);
    }
    var chips = [
      { add: "steps", set: d.steps != null, text: d.steps != null ? Number(d.steps).toLocaleString() + " steps" : "Steps" },
      { add: "weight", set: d.body_weight != null, text: d.body_weight != null ? Number(d.body_weight) + " lb" : "Weight" },
      { add: "workout", set: acts.length > 0, text: acts.length ? acts.join(", ") : "Workout" }
    ];
    chips.forEach(function (c) {
      var a = document.createElement("a");
      a.className = "chip " + c.add + (c.set ? " set" : " add");
      // A filled chip opens the day to edit; an empty one opens that field.
      a.href = "/day?d=" + t + (c.set ? "" : "&add=" + c.add);
      if (!c.set) a.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
      a.appendChild(document.createTextNode(c.text));
      host.appendChild(a);
    });
  }

  /* ---- month calendar ---- */

  function monthOf(day) { return day.slice(0, 7); }
  function lastMonth() {
    var a = monthOf(P.today()), b = monthOf(P.END);
    return a > b ? a : b;
  }
  function shiftMonth(m, n) {
    var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1 + n;
    y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
    return y + "-" + String(mo + 1).padStart(2, "0");
  }
  function kSteps(n) {
    return n >= 9950 ? Math.round(n / 1000) + "k" : n >= 1000 ? (Math.round(n / 100) / 10) + "k" : String(n);
  }

  function renderMonth() {
    var m = shown;
    var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1;
    var t = P.today();
    $("month").textContent = MONTHS[mo] + " " + y;
    $("prev").disabled = m <= FIRST_MONTH;
    $("nextm").disabled = m >= lastMonth();

    // Month line: average steps, and plan sessions done of planned.
    var days = [];
    var len = new Date(y, mo + 1, 0).getDate();
    for (var i = 1; i <= len; i++) days.push(m + "-" + String(i).padStart(2, "0"));
    var withSteps = days.filter(function (d) { return daily[d] && daily[d].steps != null; });
    var bits = [];
    if (withSteps.length) {
      var avg = Math.round(withSteps.reduce(function (s, d) { return s + daily[d].steps; }, 0) / withSteps.length);
      bits.push(avg.toLocaleString() + " avg steps");
    }
    var planned = days.filter(function (d) { return P.plannedKind(d); }).length;
    if (planned) {
      var done = days.filter(function (d) { return P.inPlan(d) && logged[d] && logged[d].done; }).length;
      var skips = days.filter(function (d) { return P.inPlan(d) && logged[d] && logged[d].done === false; }).length;
      bits.push(done + " of " + planned + " sessions" + (skips ? ", " + skips + " skipped" : ""));
    }
    $("monthstats").textContent = bits.join(" · ") || "Nothing logged";

    var host = $("weeks");
    host.textContent = "";
    var grid = document.createElement("div");
    grid.className = "grid month";
    var lead = (new Date(y, mo, 1).getDay() + 6) % 7; // Monday first
    for (var b = 0; b < lead; b++) grid.appendChild(document.createElement("span"));

    days.forEach(function (day) {
      var plannedKind = P.plannedKind(day);
      var log = logged[day];
      var kind = log ? log.kind : plannedKind;
      var isDone = !!(log && log.done);
      var isSkipped = !!(log && log.done === false);
      var missed = plannedKind && !isDone && !isSkipped && day < t;
      var steps = daily[day] && daily[day].steps;

      var el = document.createElement("a");
      el.href = "/day?d=" + day;
      el.className = "cell " + (kind || "off") + (isDone ? " done" : "") + (isSkipped ? " skipped" : "") +
        (missed ? " missed" : "") + (day < t ? " past" : "") + (day === t ? " today" : "") +
        (day > t ? " future" : "");
      var label = P.nice(day) + (kind ? ", " + P.label(kind) : "") +
        (isDone ? ", done" : isSkipped ? ", skipped" : missed ? ", missed" : "");

      var num = document.createElement("b");
      num.textContent = Number(day.slice(8));
      el.appendChild(num);
      if (isDone) {
        el.appendChild(tick());
        if (log.short) {
          var s = document.createElement("span");
          s.className = "short";
          s.textContent = "10m";
          el.appendChild(s);
        }
      } else if (isSkipped) {
        el.appendChild(skipIcon());
      } else {
        var dot = document.createElement("i");
        dot.className = "dot";
        el.appendChild(dot);
      }
      if (steps != null) {
        var st = document.createElement("span");
        st.className = "steps";
        st.textContent = kSteps(steps);
        el.appendChild(st);
        label += ", " + steps.toLocaleString() + " steps";
      }
      if (extras[day]) {
        var o = document.createElement("i");
        o.className = "other";
        el.appendChild(o);
        label += ", also " + extras[day].join(", ");
      }
      el.setAttribute("aria-label", label);
      grid.appendChild(el);
    });
    host.appendChild(grid);
  }

  function go(n) {
    var m = shiftMonth(shown, n);
    if (m < FIRST_MONTH || m > lastMonth()) return;
    shown = m;
    renderMonth();
  }

  function render() {
    renderMonth();
    renderNext();
    renderSkip();
    renderToday();
  }

  function load() {
    return Promise.all([
      K.db.from("sessions").select("day, kind, done, short, ride_minutes"),
      K.db.from("activities").select("day, name"),
      K.db.from("daily").select("day, steps, body_weight").gte("day", FIRST_MONTH + "-01")
    ]).then(function (res) {
      var bad = res.find(function (r) { return r.error; });
      if (bad) { K.showError(bad.error.message); return; }
      logged = {}; extras = {}; daily = {};
      res[0].data.forEach(function (r) { logged[r.day] = r; });
      res[1].data.forEach(function (r) { (extras[r.day] = extras[r.day] || []).push(r.name); });
      res[2].data.forEach(function (r) { daily[r.day] = r; });
      render();
    });
  }

  K.ready.then(function () {
    P.DAY_NAMES.forEach(function (n) {
      var s = document.createElement("span");
      s.textContent = n.slice(0, 1) === "T" || n.slice(0, 1) === "S" ? n.slice(0, 2) : n.slice(0, 1);
      $("dayhead").appendChild(s);
    });
    shown = monthOf(P.today()) < FIRST_MONTH ? FIRST_MONTH : monthOf(P.today());
    $("prev").addEventListener("click", function () { go(-1); });
    $("nextm").addEventListener("click", function () { go(1); });
    $("skip").addEventListener("click", onSkip);
    // Swipe left/right on the calendar to change month.
    var cal = document.querySelector(".cal"), x0 = null, y0 = null;
    cal.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    cal.addEventListener("touchend", function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    });
    renderHeader();
    render();
    load();
  });
})();
