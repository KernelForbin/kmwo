/* kmwo: log one day. /day?d=YYYY-MM-DD
   The plan session (Lift, Ride, or None) plus extras: other workouts, steps,
   and a body weight check-in. New fields start from your last log.
   Optional: &k=lift|ride preselects the session (the home "Next up" link),
   &add=workout|steps|weight opens that extra straight away. */
(function () {
  "use strict";

  var P = window.KMWO_PLAN;
  var K = window.KMWO;
  var $ = function (id) { return document.getElementById(id); };

  var params = new URLSearchParams(location.search);
  var q = params.get("d");
  var day = P.isDay(q) ? q : P.today();
  var week = P.weekOf(day);

  var kind = null;           // "lift" | "ride" | "none"
  var existing = null;       // the sessions row for this day, if any
  var hadExtras = false;     // daily or activity rows existed for this day
  var lastByEx = {};         // exercise -> { day, sets: [...] } from before this day
  var setsByEx = {};         // exercise -> [{ weight, reps }] being edited
  var easyByEx = {};         // exercise -> bool

  var workouts = [];         // [{ name, minutes }] other workouts on this day
  var steps = { on: false, value: null };
  var weight = { on: false, value: null };
  var lastWeigh = null;      // { day, value } latest body weight before this day
  var lastMinutes = {};      // workout name -> minutes, most recent log
  var known = [];            // workout names to offer, most recently used first
  var saved = [];            // names in workout_types

  function num(v) {
    if (v === "" || v == null) return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  function fmtW(w) { return w == null ? "?" : String(Number(w)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function cleanName(s) {
    s = (s || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }
  function same(a, b) { return a.toLowerCase() === b.toLowerCase(); }

  /* A − [input] + control.
     o: { value, step, min, max, label, onChange, decimal, placeholder, from }
     from: where + and − start when the box is empty (e.g. last weigh-in). */
  function stepper(o) {
    var wrap = el("div", "stepper");
    var dec = el("button", null, "−");
    dec.type = "button"; dec.setAttribute("aria-label", o.label + ", less");
    var inc = el("button", null, "+");
    inc.type = "button"; inc.setAttribute("aria-label", o.label + ", more");
    var inp = document.createElement("input");
    inp.type = "number"; inp.inputMode = o.decimal ? "decimal" : "numeric";
    inp.min = String(o.min); inp.max = String(o.max); inp.step = o.decimal ? "0.1" : "1";
    inp.placeholder = o.placeholder || ""; inp.setAttribute("aria-label", o.label);
    inp.value = o.value == null ? "" : o.value;
    inp.addEventListener("input", function () { o.onChange(num(inp.value)); });
    function bump(d) {
      var cur = num(inp.value);
      var next = cur == null && o.from != null ? o.from : (cur == null ? 0 : cur) + d;
      next = Math.min(o.max, Math.max(o.min, Math.round(next * 10) / 10));
      inp.value = next;
      o.onChange(next);
    }
    dec.addEventListener("click", function () { bump(-o.step); });
    inc.addEventListener("click", function () { bump(o.step); });
    wrap.append(dec, inp, inc);
    return wrap;
  }

  /* ---- lift ---- */

  function lastLine(ex) {
    var last = lastByEx[ex];
    if (!last) return { text: "First time logging this one.", up: false, top: -1 };
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
      var card = el("div", "card");
      var head = el("div", "ex-head");
      head.append(el("h3", null, ex.name + (ex.note ? " (" + ex.note + ")" : "")),
        el("span", "target", P.setsFor(week) + " × 10"));
      card.appendChild(head);

      var info = lastLine(ex.id);
      card.appendChild(el("p", "muted small", info.text));
      if (info.up) card.appendChild(el("p", "nudge small", "Every set of 10 felt easy last time: go up one weight today."));

      var rows = setsByEx[ex.id];
      var grid = el("div", "setgrid");
      ["", "Weight (lb)", "Reps"].forEach(function (t) { grid.appendChild(el("span", "colhead", t)); });
      rows.forEach(function (s, i) {
        grid.append(
          el("span", "n", String(i + 1)),
          stepper({ value: s.weight, step: 5, min: 0, max: 500, decimal: true, placeholder: "lb",
            label: ex.name + " set " + (i + 1) + " weight", onChange: function (v) { s.weight = v; } }),
          stepper({ value: s.reps, step: 1, min: 0, max: 100, placeholder: "reps",
            label: ex.name + " set " + (i + 1) + " reps", onChange: function (v) { s.reps = v; } })
        );
      });
      card.appendChild(grid);

      var tools = el("div", "settools");
      var add = el("button", "link", "+ Set");
      add.type = "button";
      add.addEventListener("click", function () {
        var prev = rows[rows.length - 1];
        if (rows.length < 10) rows.push({ weight: prev ? prev.weight : null, reps: prev ? prev.reps : 10 });
        renderLift();
      });
      tools.appendChild(add);
      if (rows.length > 1) {
        var rm = el("button", "link", "− Set");
        rm.type = "button";
        rm.addEventListener("click", function () { rows.pop(); renderLift(); });
        tools.appendChild(rm);
      }
      var easyLab = el("label", "check small");
      var easy = document.createElement("input");
      easy.type = "checkbox";
      easy.checked = !!easyByEx[ex.id];
      easy.addEventListener("change", function () { easyByEx[ex.id] = easy.checked; });
      easyLab.append(easy, el("span", null, "Every set felt easy"));
      tools.appendChild(easyLab);
      card.appendChild(tools);
      host.appendChild(card);
    });
  }

  // Today's sets if logged; otherwise start from the last log of each
  // exercise, set by set (weight and reps), with the plan's set count.
  function initSets(todaySets) {
    P.EXERCISES.forEach(function (ex) {
      var mine = todaySets.filter(function (s) { return s.exercise === ex.id; })
        .sort(function (a, b) { return a.set_no - b.set_no; });
      if (mine.length) {
        setsByEx[ex.id] = mine.map(function (s) { return { weight: s.weight == null ? null : Number(s.weight), reps: s.reps }; });
        easyByEx[ex.id] = mine.every(function (s) { return s.easy; });
        return;
      }
      var last = lastByEx[ex.id];
      var prev = last ? last.sets : [];
      var top = lastLine(ex.id).top;
      setsByEx[ex.id] = [];
      for (var i = 0; i < P.setsFor(week); i++) {
        var p = prev[i] || prev[prev.length - 1];
        setsByEx[ex.id].push({
          weight: p && p.weight != null ? p.weight : (top >= 0 ? top : null),
          reps: p && p.reps != null ? p.reps : 10
        });
      }
      easyByEx[ex.id] = false;
    });
  }

  /* ---- extras: other workouts, steps, body weight ---- */

  function extraCard(title, sub, control, onRemove, tone) {
    var c = el("div", "extra" + (tone ? " " + tone : ""));
    var t = el("div", "extra-name");
    t.appendChild(el("strong", null, title));
    if (sub) t.appendChild(el("span", "muted small", sub));
    var x = el("button", "iconbtn x");
    x.type = "button";
    x.setAttribute("aria-label", "Remove " + title);
    x.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.addEventListener("click", onRemove);
    c.append(t, control, x);
    return c;
  }

  function renderExtras() {
    var host = $("extras");
    host.textContent = "";
    workouts.forEach(function (w, i) {
      host.appendChild(extraCard(w.name, "Minutes",
        stepper({ value: w.minutes, step: 5, min: 1, max: 600, placeholder: "min",
          label: w.name + " minutes", onChange: function (v) { w.minutes = v; } }),
        function () { workouts.splice(i, 1); renderExtras(); }, "other"));
    });
    if (steps.on) {
      host.appendChild(extraCard("Steps", null,
        stepper({ value: steps.value, step: 1000, min: 0, max: 200000, placeholder: "steps",
          label: "Steps", onChange: function (v) { steps.value = v; } }),
        function () { steps.on = false; steps.value = null; renderExtras(); }, "steps"));
    }
    if (weight.on) {
      host.appendChild(extraCard("Body weight",
        lastWeigh ? "Last: " + fmtW(lastWeigh.value) + " lb · " + P.md(lastWeigh.day) : "lb",
        stepper({ value: weight.value, step: 0.2, min: 50, max: 700, decimal: true, placeholder: "lb",
          from: lastWeigh ? lastWeigh.value : null,
          label: "Body weight", onChange: function (v) { weight.value = v; } }),
        function () { weight.on = false; weight.value = null; renderExtras(); }, "weight"));
    }
    if (!host.children.length) host.appendChild(el("p", "muted small extras-empty", "Other workouts, steps, or a weigh-in."));
    document.querySelector('[data-add="steps"]').hidden = steps.on;
    document.querySelector('[data-add="weight"]').hidden = weight.on;
  }

  function focusLast(cls) {
    var cards = document.querySelectorAll("#extras .extra" + (cls ? "." + cls : ""));
    var c = cards[cards.length - 1];
    if (!c) return;
    c.scrollIntoView({ block: "center", behavior: "smooth" });
    var inp = c.querySelector("input");
    if (inp && cls !== "other") inp.focus();
  }

  function addWorkout(name) {
    name = cleanName(name);
    if (!name) return;
    var match = known.find(function (n) { return same(n, name); });
    if (match) name = match;
    workouts.push({ name: name, minutes: lastMinutes[name] || 30 });
    closeSheet();
    renderExtras();
    focusLast("other");
  }

  /* ---- workout picker sheet ---- */

  function renderChips() {
    var text = cleanName($("sheet-input").value);
    var host = $("sheet-chips");
    host.textContent = "";
    var list = known.filter(function (n) { return !text || n.toLowerCase().indexOf(text.toLowerCase()) !== -1; });
    list.forEach(function (n) {
      var b = el("button", "chip" + (saved.indexOf(n) !== -1 ? " mine" : ""), n);
      b.type = "button";
      if (lastMinutes[n]) b.appendChild(el("span", null, lastMinutes[n] + "m"));
      b.addEventListener("click", function () { addWorkout(n); });
      host.appendChild(b);
    });
    var exact = text && known.some(function (n) { return same(n, text); });
    $("sheet-addnew").hidden = !text || exact;
    $("sheet-hint").textContent = text && !exact
      ? "“" + text + "” will be saved to this list for next time."
      : "New names are saved to this list for next time.";
  }

  function openSheet() {
    $("sheet").hidden = false;
    $("sheet-input").value = "";
    renderChips();
    document.body.classList.add("noscroll");
  }
  function closeSheet() {
    $("sheet").hidden = true;
    document.body.classList.remove("noscroll");
  }

  function openExtra(what) {
    if (what === "workout") openSheet();
    if (what === "steps") { steps.on = true; renderExtras(); focusLast("steps"); }
    if (what === "weight") { weight.on = true; renderExtras(); focusLast("weight"); }
  }

  /* ---- shared view ---- */

  function saveLabel() {
    var any = existing || hadExtras;
    $("save").textContent = any ? "Save changes" : (kind === "none" ? "Save" : "Save and mark done");
  }

  function setKind(k) {
    kind = k;
    document.querySelectorAll(".seg button").forEach(function (b) {
      var on = b.dataset.kind === k;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
    var short = $("short").checked;
    $("plansection").hidden = k === "none";
    $("short-desc").hidden = !short;
    $("lift").hidden = k !== "lift" || short;
    $("ride").hidden = k !== "ride" || short;
    if (k === "lift" && !short) renderLift();
    saveLabel();
  }

  function fillRideTypes() {
    P.RIDE_TYPES.forEach(function (t) {
      var o = el("option", null, t);
      o.value = t;
      $("ride-type").appendChild(o);
    });
    $("ride-hint").textContent = week >= 5
      ? "From week 5, one ride a week can be a harder class (HIIT, Tabata, Power Zone). Optional."
      : P.describe("ride", week) + ".";
  }

  /* ---- load and save ---- */

  function must(r) { if (r.error) throw r.error; return r.data || []; }

  function load() {
    var db = K.db;
    return Promise.all([
      db.from("sessions").select("day, kind, done, short, ride_minutes, ride_type, note"),
      db.from("sets").select("day, exercise, set_no, weight, reps, easy").lte("day", day)
        .order("day", { ascending: false }).limit(200),
      db.from("daily").select("day, steps, body_weight").lte("day", day)
        .order("day", { ascending: false }).limit(120),
      db.from("activities").select("day, name, minutes").order("day", { ascending: false }).limit(500),
      db.from("workout_types").select("name").order("created_at")
    ]).then(function (res) {
      var sessions = must(res[0]);
      var sets = must(res[1]).map(function (s) { s.weight = s.weight == null ? null : Number(s.weight); return s; });
      var daily = must(res[2]);
      var acts = must(res[3]);
      saved = must(res[4]).map(function (r) { return r.name; });

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

      // Extras for this day, and what to start from.
      var mine = daily.find(function (r) { return r.day === day; });
      if (mine && mine.steps != null) { steps.on = true; steps.value = mine.steps; }
      if (mine && mine.body_weight != null) { weight.on = true; weight.value = Number(mine.body_weight); }
      var lw = daily.find(function (r) { return r.day < day && r.body_weight != null; });
      if (lw) lastWeigh = { day: lw.day, value: Number(lw.body_weight) };

      acts.forEach(function (a) {
        if (a.day === day) workouts.push({ name: a.name, minutes: a.minutes });
        else if (lastMinutes[a.name] == null && a.minutes != null && a.day < day) lastMinutes[a.name] = a.minutes;
        if (known.indexOf(a.name) === -1) known.push(a.name);
      });
      saved.concat(P.OTHER_WORKOUTS).forEach(function (n) {
        if (!known.some(function (k) { return same(k, n); })) known.push(n);
      });
      hadExtras = !!mine || workouts.length > 0;

      // The plan session: what's logged, else the link's pick, else the plan.
      var lastRide = sessions.filter(function (s) {
        return s.kind === "ride" && s.day < day && !s.short && s.ride_minutes;
      }).sort(function (a, b) { return a.day < b.day ? 1 : -1; })[0];
      var startKind;
      if (existing) {
        startKind = existing.kind;
        $("short").checked = !!existing.short;
        $("note").value = existing.note || "";
        $("ride-min").value = existing.ride_minutes || P.rideMinutes(week);
        if (existing.ride_type) $("ride-type").value = existing.ride_type;
      } else {
        var k = params.get("k");
        startKind = k === "lift" || k === "ride" ? k : (P.plannedKind(day) || "none");
        // Last ride's length and class, but never under this week's plan.
        $("ride-min").value = Math.max(lastRide ? lastRide.ride_minutes : 0, P.rideMinutes(week));
        if (lastRide && lastRide.ride_type) $("ride-type").value = lastRide.ride_type;
      }
      $("clear").hidden = !(existing || hadExtras);

      var planned = P.plannedKind(day);
      $("planned").textContent = planned
        ? "Planned: " + P.describe(planned, week)
        : (P.inPlan(day) ? "Not a planned day. Pick Lift or Ride if this is your next free day." : "Outside the 8-week plan.");
      setKind(startKind);
      renderExtras();
      var add = params.get("add");
      if (add) openExtra(add);
    });
  }

  function save() {
    var db = K.db;
    var short = $("short").checked;
    var plan = kind !== "none";
    var row = plan ? {
      day: day, kind: kind, done: true, short: short,
      note: $("note").value.trim() || null,
      ride_minutes: kind === "ride" && !short ? num($("ride-min").value) : null,
      ride_type: kind === "ride" && !short ? $("ride-type").value : null
    } : null;
    var setRows = [];
    if (kind === "lift" && !short) {
      P.EXERCISES.forEach(function (ex) {
        setsByEx[ex.id].forEach(function (s, i) {
          if (s.weight == null && s.reps == null) return;
          setRows.push({ day: day, exercise: ex.id, set_no: i + 1, weight: s.weight, reps: s.reps, easy: !!easyByEx[ex.id] });
        });
      });
    }
    var st = steps.on ? steps.value : null;
    var bw = weight.on ? weight.value : null;
    var actRows = workouts.map(function (w) {
      return { day: day, name: w.name, minutes: w.minutes == null ? null : Math.round(w.minutes) };
    });
    // Names not in the starter list or already saved get saved for next time.
    var newTypes = [];
    actRows.forEach(function (a) {
      var isKnown = saved.concat(P.OTHER_WORKOUTS).some(function (n) { return same(n, a.name); });
      if (!isKnown && !newTypes.some(function (t) { return same(t.name, a.name); })) newTypes.push({ name: a.name });
    });

    $("save").disabled = true;
    K.showError("");
    var chain = Promise.resolve();
    function step(fn) { chain = chain.then(fn).then(function (r) { if (r && r.error) throw r.error; }); }

    // Plan session and its sets.
    step(function () { return db.from("sets").delete().eq("day", day); });
    if (plan) {
      step(function () { return db.from("sessions").upsert(row, { onConflict: "user_id,day" }); });
      if (setRows.length) step(function () { return db.from("sets").insert(setRows); });
    } else if (existing) {
      step(function () { return db.from("sessions").delete().eq("day", day); });
    }
    // Steps and body weight.
    if (st != null || bw != null) {
      step(function () {
        return db.from("daily").upsert({ day: day, steps: st, body_weight: bw, updated_at: new Date().toISOString() },
          { onConflict: "user_id,day" });
      });
    } else {
      step(function () { return db.from("daily").delete().eq("day", day); });
    }
    // Other workouts.
    if (newTypes.length) {
      step(function () { return db.from("workout_types").upsert(newTypes, { onConflict: "user_id,name", ignoreDuplicates: true }); });
    }
    step(function () { return db.from("activities").delete().eq("day", day); });
    if (actRows.length) step(function () { return db.from("activities").insert(actRows); });

    chain.then(function () { location.href = "/"; })
      .catch(function (e) {
        $("save").disabled = false;
        K.showError(e.message || String(e));
      });
  }

  function clearLog() {
    if (!confirm("Remove everything logged for " + P.nice(day) + "?")) return;
    var db = K.db;
    var chain = Promise.resolve();
    ["sets", "sessions", "daily", "activities"].forEach(function (t) {
      chain = chain.then(function () { return db.from(t).delete().eq("day", day); })
        .then(function (r) { if (r.error) throw r.error; });
    });
    chain.then(function () { location.href = "/"; })
      .catch(function (e) { K.showError(e.message || String(e)); });
  }

  K.ready.then(function () {
    var dt = P.parseDay(day);
    var full = dt.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    var nice = P.nice(day);
    var rel = nice === "Today" || nice === "Tomorrow";
    $("title").textContent = rel ? nice : full;
    $("weeklabel").textContent = (rel ? full : "") +
      (P.inPlan(day) ? (rel ? " · " : "") + "Week " + week + " of " + P.WEEKS : "");
    fillRideTypes();
    document.querySelectorAll(".seg button").forEach(function (b) {
      b.addEventListener("click", function () { setKind(b.dataset.kind); });
    });
    $("short").addEventListener("change", function () { setKind(kind); });
    [["ride-dec", -5], ["ride-inc", 5]].forEach(function (p) {
      $(p[0]).addEventListener("click", function () {
        var v = num($("ride-min").value) || 0;
        $("ride-min").value = Math.min(300, Math.max(5, v + p[1]));
      });
    });
    document.querySelectorAll("[data-add]").forEach(function (b) {
      b.addEventListener("click", function () { openExtra(b.dataset.add); });
    });
    $("sheet-input").addEventListener("input", renderChips);
    $("sheet-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var text = cleanName($("sheet-input").value);
      if (text) addWorkout(text);
    });
    $("sheet").addEventListener("click", function (e) { if (e.target === $("sheet")) closeSheet(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("sheet").hidden) closeSheet(); });
    $("save").addEventListener("click", save);
    $("clear").addEventListener("click", clearLog);
    load().catch(function (e) { K.showError(e.message || String(e)); });
  });
})();
