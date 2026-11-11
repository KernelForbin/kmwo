/* kmwo: log one day's session (lift sets, or ride details). /day?d=YYYY-MM-DD */
(function () {
  "use strict";

  var P = window.KMWO_PLAN;
  var K = window.KMWO;
  var $ = function (id) { return document.getElementById(id); };

  var q = new URLSearchParams(location.search).get("d");
  var day = P.isDay(q) ? q : P.today();
  var week = P.weekOf(day);

  var kind = null;
  var existing = null;   // the sessions row for this day, if any
  var lastByEx = {};     // exercise -> { day, sets: [...] } from before this day
  var setsByEx = {};     // exercise -> [{ weight, reps }] being edited
  var easyByEx = {};     // exercise -> bool

  function num(v) {
    if (v === "" || v == null) return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  function fmtW(w) { return w == null ? "?" : String(Number(w)); }

  /* ---- lift ---- */

  function lastLine(ex) {
    var last = lastByEx[ex];
    if (!last) return { text: "First time logging this one.", up: false };
    var top = last.sets.reduce(function (m, s) { return s.weight != null && s.weight > m ? s.weight : m; }, -1);
    var reps = last.sets.map(function (s) { return s.reps == null ? "?" : s.reps; }).join(", ");
    var allTen = last.sets.length > 0 && last.sets.every(function (s) { return (s.reps || 0) >= 10; });
    var easy = last.sets.length > 0 && last.sets.every(function (s) { return s.easy; });
    return {
      text: "Last time (" + P.md(last.day) + "): " + (top >= 0 ? fmtW(top) + " lb" : "no weight") + " × " + reps,
      up: allTen && easy,
      top: top
    };
  }

  function renderLift() {
    var host = $("lift");
    host.textContent = "";
    P.EXERCISES.forEach(function (ex) {
      var card = document.createElement("div");
      card.className = "card";

      var h = document.createElement("h3");
      h.textContent = ex.name + (ex.note ? " (" + ex.note + ")" : "");
      card.appendChild(h);

      var info = lastLine(ex.id);
      var last = document.createElement("p");
      last.className = "muted small";
      last.textContent = info.text;
      card.appendChild(last);
      if (info.up) {
        var up = document.createElement("p");
        up.className = "nudge small";
        up.textContent = "Every set of 10 felt easy last time: go up one weight today.";
        card.appendChild(up);
      }

      var rows = setsByEx[ex.id];
      rows.forEach(function (s, i) {
        var row = document.createElement("div");
        row.className = "setrow";
        var lab = document.createElement("span");
        lab.className = "muted small";
        lab.textContent = "Set " + (i + 1);
        var w = document.createElement("input");
        w.type = "number"; w.inputMode = "decimal"; w.min = "0"; w.step = "0.5";
        w.placeholder = "lb"; w.setAttribute("aria-label", ex.name + " set " + (i + 1) + " weight");
        w.value = s.weight == null ? "" : s.weight;
        w.addEventListener("input", function () { s.weight = num(w.value); });
        var x = document.createElement("span");
        x.className = "muted";
        x.textContent = "lb ×";
        var r = document.createElement("input");
        r.type = "number"; r.inputMode = "numeric"; r.min = "0"; r.max = "100";
        r.setAttribute("aria-label", ex.name + " set " + (i + 1) + " reps");
        r.value = s.reps == null ? "" : s.reps;
        r.addEventListener("input", function () { s.reps = num(r.value); });
        row.append(lab, w, x, r);
        card.appendChild(row);
      });

      var tools = document.createElement("div");
      tools.className = "settools";
      var add = document.createElement("button");
      add.type = "button"; add.className = "link"; add.textContent = "+ Set";
      add.addEventListener("click", function () {
        var prev = rows[rows.length - 1];
        if (rows.length < 10) rows.push({ weight: prev ? prev.weight : null, reps: 10 });
        renderLift();
      });
      tools.appendChild(add);
      if (rows.length > 1) {
        var rm = document.createElement("button");
        rm.type = "button"; rm.className = "link"; rm.textContent = "− Set";
        rm.addEventListener("click", function () { rows.pop(); renderLift(); });
        tools.appendChild(rm);
      }
      var easyLab = document.createElement("label");
      easyLab.className = "check small";
      var easy = document.createElement("input");
      easy.type = "checkbox";
      easy.checked = !!easyByEx[ex.id];
      easy.addEventListener("change", function () { easyByEx[ex.id] = easy.checked; });
      var et = document.createElement("span");
      et.textContent = "Every set felt easy";
      easyLab.append(easy, et);
      tools.appendChild(easyLab);
      card.appendChild(tools);

      host.appendChild(card);
    });
  }

  /* ---- shared view ---- */

  function setKind(k) {
    kind = k;
    document.querySelectorAll(".seg button").forEach(function (b) {
      var on = b.dataset.kind === k;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
    var short = $("short").checked;
    $("short-desc").hidden = !short;
    $("lift").hidden = k !== "lift" || short;
    $("ride").hidden = k !== "ride" || short;
    if (k === "lift" && !short) renderLift();
  }

  function fillRideTypes() {
    P.RIDE_TYPES.forEach(function (t) {
      var o = document.createElement("option");
      o.value = t; o.textContent = t;
      $("ride-type").appendChild(o);
    });
    $("ride-hint").textContent = week >= 5
      ? "From week 5, one ride a week can be a harder class (HIIT, Tabata, Power Zone). Optional."
      : P.describe("ride", week) + ".";
  }

  function initSets(todaySets) {
    P.EXERCISES.forEach(function (ex) {
      var mine = todaySets.filter(function (s) { return s.exercise === ex.id; })
        .sort(function (a, b) { return a.set_no - b.set_no; });
      if (mine.length) {
        setsByEx[ex.id] = mine.map(function (s) { return { weight: s.weight == null ? null : Number(s.weight), reps: s.reps }; });
        easyByEx[ex.id] = mine.every(function (s) { return s.easy; });
      } else {
        var info = lastLine(ex.id);
        var w = info.top >= 0 ? info.top : null;
        setsByEx[ex.id] = [];
        for (var i = 0; i < P.setsFor(week); i++) setsByEx[ex.id].push({ weight: w, reps: 10 });
        easyByEx[ex.id] = false;
      }
    });
  }

  /* ---- load and save ---- */

  function load() {
    var db = K.db;
    return Promise.all([
      db.from("sessions").select("day, kind, done, short, ride_minutes, ride_type, note"),
      db.from("sets").select("day, exercise, set_no, weight, reps, easy").lte("day", day)
        .order("day", { ascending: false }).limit(200)
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      if (res[1].error) throw res[1].error;
      var sessions = res[0].data || [];
      var sets = (res[1].data || []).map(function (s) {
        s.weight = s.weight == null ? null : Number(s.weight);
        return s;
      });

      existing = sessions.find(function (s) { return s.day === day; }) || null;

      sets.filter(function (s) { return s.day < day; }).forEach(function (s) {
        var l = lastByEx[s.exercise];
        if (!l) l = lastByEx[s.exercise] = { day: s.day, sets: [] };
        if (l.day === s.day) l.sets.push(s);
      });
      Object.keys(lastByEx).forEach(function (k) {
        lastByEx[k].sets.sort(function (a, b) { return a.set_no - b.set_no; });
      });

      initSets(sets.filter(function (s) { return s.day === day; }));

      var startKind;
      if (existing) {
        startKind = existing.kind;
        $("short").checked = !!existing.short;
        $("note").value = existing.note || "";
        $("ride-min").value = existing.ride_minutes || P.rideMinutes(week);
        if (existing.ride_type) $("ride-type").value = existing.ride_type;
        $("clear").hidden = false;
        $("save").textContent = "Save changes";
      } else {
        var done = sessions.filter(function (s) { return s.done && s.day < day; }).map(function (s) { return s.day; });
        var seqKind = P.PATTERN[done.filter(P.inPlan).length % P.PATTERN.length];
        startKind = P.plannedKind(day) || seqKind;
        $("ride-min").value = P.rideMinutes(week);
      }

      var planned = P.plannedKind(day);
      $("planned").textContent = planned
        ? "Planned: " + P.describe(planned, week)
        : (P.inPlan(day) ? "Not a planned day. Log here if this is your next free day." : "Outside the 8-week plan.");
      setKind(startKind);
    });
  }

  function save() {
    var db = K.db;
    var short = $("short").checked;
    var row = {
      day: day, kind: kind, done: true, short: short,
      note: $("note").value.trim() || null,
      ride_minutes: kind === "ride" && !short ? num($("ride-min").value) : null,
      ride_type: kind === "ride" && !short ? $("ride-type").value : null
    };
    var setRows = [];
    if (kind === "lift" && !short) {
      P.EXERCISES.forEach(function (ex) {
        setsByEx[ex.id].forEach(function (s, i) {
          if (s.weight == null && s.reps == null) return;
          setRows.push({ day: day, exercise: ex.id, set_no: i + 1, weight: s.weight, reps: s.reps, easy: !!easyByEx[ex.id] });
        });
      });
    }
    $("save").disabled = true;
    K.showError("");
    db.from("sessions").upsert(row, { onConflict: "user_id,day" })
      .then(function (r) { if (r.error) throw r.error; return db.from("sets").delete().eq("day", day); })
      .then(function (r) {
        if (r.error) throw r.error;
        return setRows.length ? db.from("sets").insert(setRows) : { error: null };
      })
      .then(function (r) {
        if (r.error) throw r.error;
        location.href = "/";
      })
      .catch(function (e) {
        $("save").disabled = false;
        K.showError(e.message || String(e));
      });
  }

  function clearLog() {
    if (!confirm("Remove the log for " + P.nice(day) + "?")) return;
    var db = K.db;
    db.from("sets").delete().eq("day", day)
      .then(function (r) { if (r.error) throw r.error; return db.from("sessions").delete().eq("day", day); })
      .then(function (r) { if (r.error) throw r.error; location.href = "/"; })
      .catch(function (e) { K.showError(e.message || String(e)); });
  }

  K.ready.then(function () {
    $("title").textContent = P.nice(day) === "Today" ? "Today, " + P.md(day) : P.nice(day);
    $("weeklabel").textContent = P.inPlan(day) ? "Week " + week + " of " + P.WEEKS : "";
    fillRideTypes();
    document.querySelectorAll(".seg button").forEach(function (b) {
      b.addEventListener("click", function () { setKind(b.dataset.kind); });
    });
    $("short").addEventListener("change", function () { setKind(kind); });
    $("save").addEventListener("click", save);
    $("clear").addEventListener("click", clearLog);
    load().catch(function (e) { K.showError(e.message || String(e)); });
  });
})();
