/* kmwo: progress. Stat tiles, sessions per week, top set weight per lift. */
(function () {
  "use strict";

  var P = window.KMWO_PLAN;
  var K = window.KMWO;
  var $ = function (id) { return document.getElementById(id); };
  var SVG = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ---- tiles ---- */

  function tile(value, label) {
    var t = el("div", "tile");
    t.append(el("strong", null, value), el("span", "muted small", label));
    return t;
  }

  function weekCounts(done) {
    var counts = [];
    for (var w = 1; w <= P.WEEKS; w++) counts.push(0);
    done.forEach(function (s) { if (P.inPlan(s.day)) counts[P.weekOf(s.day) - 1]++; });
    return counts;
  }

  function renderTiles(done, counts) {
    var t = P.today();
    var inPlan = done.filter(function (s) { return P.inPlan(s.day); });
    var curWeek = t < P.START ? 0 : (t > P.END ? P.WEEKS + 1 : P.weekOf(t));

    // Streak: consecutive finished weeks with all 3 sessions, counting back.
    var streak = 0;
    for (var w = Math.min(curWeek - 1, P.WEEKS); w >= 1; w--) {
      if (counts[w - 1] >= 3) streak++; else break;
    }
    if (curWeek >= 1 && curWeek <= P.WEEKS && counts[curWeek - 1] >= 3) streak++;

    var rideMin = done.reduce(function (m, s) { return m + (s.kind === "ride" ? (s.ride_minutes || 0) : 0); }, 0);

    // Ring: sessions done of 24.
    var pct = Math.min(1, inPlan.length / P.TOTAL);
    var C = 2 * Math.PI * 44;
    var ring = el("div", "ring");
    var svg = svgEl("svg", { viewBox: "0 0 104 104", "aria-hidden": "true" });
    svg.appendChild(svgEl("circle", { cx: 52, cy: 52, r: 44, class: "track" }));
    svg.appendChild(svgEl("circle", { cx: 52, cy: 52, r: 44, class: "fill",
      "stroke-dasharray": C, "stroke-dashoffset": C * (1 - pct) }));
    var lbl = el("div", "lbl");
    var inner = el("div");
    inner.append(el("strong", null, String(inPlan.length)), el("br"), el("span", null, "of " + P.TOTAL));
    lbl.appendChild(inner);
    ring.append(svg, lbl);
    var lifts = inPlan.filter(function (s) { return s.kind === "lift"; }).length;
    var text = el("div");
    text.append(
      el("p", "eyebrow", "Sessions done"),
      el("h3", null, Math.round(pct * 100) + "% of the plan"),
      el("p", "muted small", lifts + (lifts === 1 ? " lift" : " lifts") + " · " +
        (inPlan.length - lifts) + (inPlan.length - lifts === 1 ? " ride" : " rides"))
    );
    var rc = $("ringcard");
    rc.textContent = "";
    rc.append(ring, text);
    rc.setAttribute("aria-label", inPlan.length + " of " + P.TOTAL + " sessions done");

    if (curWeek >= 1 && curWeek <= P.WEEKS) $("weeklabel").textContent = "Week " + curWeek + " of " + P.WEEKS;

    var host = $("tiles");
    host.textContent = "";
    host.append(
      tile(curWeek >= 1 && curWeek <= P.WEEKS ? counts[curWeek - 1] + "/3" : "–", "this week"),
      tile(String(streak), streak === 1 ? "week streak" : "week streak"),
      tile(String(rideMin), "ride min")
    );
  }

  /* ---- sessions per week (bars against the target of 3) ---- */

  function renderWeekly(counts) {
    var W = 320, H = 150, padL = 24, padB = 22, padT = 16;
    var max = 4;
    var bw = (W - padL) / P.WEEKS;
    var y = function (v) { return H - padB - (v / max) * (H - padB - padT); };
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Sessions per week, target 3: " + counts.join(", ") });

    [0, 3].forEach(function (v) {
      svg.appendChild(svgEl("line", { x1: padL, x2: W, y1: y(v), y2: y(v),
        class: v === 3 ? "goal" : "axis" }));
    });
    var tl = svgEl("text", { x: padL - 6, y: y(3) + 4, class: "tick", "text-anchor": "end" });
    tl.textContent = "3";
    svg.appendChild(tl);

    var note = el("p", "muted small chart-note", "Tap a week for details.");
    counts.forEach(function (c, i) {
      var x = padL + i * bw + bw * 0.2, w = bw * 0.6;
      if (c > 0) {
        var top = y(Math.min(c, max)), h = y(0) - top, r = Math.min(4, h);
        svg.appendChild(svgEl("path", { class: c >= 3 ? "bar full" : "bar",
          d: "M" + x + "," + y(0) + "V" + (top + r) + "q0,-" + r + " " + r + ",-" + r +
             "H" + (x + w - r) + "q" + r + ",0 " + r + "," + r + "V" + y(0) + "Z" }));
        var v = svgEl("text", { x: x + w / 2, y: top - 4, class: "val", "text-anchor": "middle" });
        v.textContent = c;
        svg.appendChild(v);
      }
      var lab = svgEl("text", { x: x + w / 2, y: H - 6, class: "tick", "text-anchor": "middle" });
      lab.textContent = "W" + (i + 1);
      svg.appendChild(lab);
      var hit = svgEl("rect", { x: padL + i * bw, y: padT, width: bw, height: H - padT - padB, class: "hit" });
      hit.addEventListener("pointerenter", function () { note.textContent = "Week " + (i + 1) + ": " + c + " of 3 sessions"; });
      hit.addEventListener("click", function () { note.textContent = "Week " + (i + 1) + ": " + c + " of 3 sessions"; });
      svg.appendChild(hit);
    });

    var host = $("weekly");
    host.textContent = "";
    host.appendChild(svg);
    host.appendChild(note);
  }

  /* ---- line chart over dated points (lift top sets, body weight) ----
     pts: [{ day, top, detail }] in date order. Returns the filled card. */

  function lineCard(title, pts, opts) {
    var card = el("div", "card chart");
    var head = el("div", "ex-head");
    head.appendChild(el("h3", null, title));
    card.appendChild(head);
    if (!pts.length) {
      card.appendChild(el("p", "muted small", opts.empty));
      return card;
    }

    if (pts.length > 1) {
      var delta = Math.round((pts[pts.length - 1].top - pts[0].top) * 10) / 10;
      head.appendChild(el("span", "target", (delta >= 0 ? "+" : "−") + Math.abs(delta) + " lb"));
    }
    var W = 320, H = 130, padL = 34, padR = 48, padT = 12, padB = 20;
    var lo = Math.min.apply(null, pts.map(function (p) { return p.top; }));
    var hi = Math.max.apply(null, pts.map(function (p) { return p.top; }));
    if (hi === lo) { lo = Math.max(0, lo - opts.pad); hi = hi + opts.pad; }
    var x = function (i) { return pts.length === 1 ? (padL + W - padR) / 2 : padL + i * (W - padL - padR) / (pts.length - 1); };
    var y = function (v) { return H - padB - (v - lo) / (hi - lo) * (H - padT - padB); };

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": title + ": " + pts.map(function (p) { return P.md(p.day) + " " + p.top + " lb"; }).join(", ") });
    [lo, hi].forEach(function (v) {
      svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: "axis" }));
      var t = svgEl("text", { x: padL - 6, y: y(v) + 4, class: "tick", "text-anchor": "end" });
      t.textContent = opts.decimals ? v.toFixed(1) : Math.round(v);
      svg.appendChild(t);
    });
    [0, pts.length - 1].forEach(function (i, k) {
      if (k === 1 && i === 0) return;
      var t = svgEl("text", { x: x(i), y: H - 4, class: "tick", "text-anchor": "middle" });
      t.textContent = P.md(pts[i].day);
      svg.appendChild(t);
    });
    if (pts.length > 1) {
      svg.appendChild(svgEl("path", { class: "area",
        d: "M" + x(0) + "," + y(lo) + pts.map(function (p, i) { return "L" + x(i) + "," + y(p.top); }).join("") +
           "L" + x(pts.length - 1) + "," + y(lo) + "Z" }));
      svg.appendChild(svgEl("polyline", { class: "line",
        points: pts.map(function (p, i) { return x(i) + "," + y(p.top); }).join(" ") }));
    }
    var note = el("p", "muted small chart-note", "Tap a point for details.");
    pts.forEach(function (p, i) {
      svg.appendChild(svgEl("circle", { cx: x(i), cy: y(p.top), r: 4, class: "dot" }));
      var show = function () { note.textContent = P.md(p.day) + ": " + p.top + " lb" + (p.detail || ""); };
      var hit = svgEl("circle", { cx: x(i), cy: y(p.top), r: 14, class: "hit" });
      hit.addEventListener("pointerenter", show);
      hit.addEventListener("click", show);
      svg.appendChild(hit);
    });
    var last = pts[pts.length - 1];
    var lv = svgEl("text", { x: x(pts.length - 1) + 8, y: y(last.top) + 4, class: "val" });
    lv.textContent = last.top + " lb";
    svg.appendChild(lv);

    card.append(svg, note);

    var det = el("details");
    det.appendChild(el("summary", "small", "Table"));
    var table = el("table", "small");
    var hr = el("tr");
    opts.cols.forEach(function (h) { hr.appendChild(el("th", null, h)); });
    table.appendChild(hr);
    pts.forEach(function (p) {
      var tr = el("tr");
      tr.append(el("td", null, P.md(p.day)), el("td", null, String(p.top)));
      if (opts.cols.length > 2) tr.appendChild(el("td", null, p.reps.join(", ")));
      table.appendChild(tr);
    });
    det.appendChild(table);
    card.appendChild(det);
    return card;
  }

  /* ---- top set weight per lift ---- */

  function renderLift(ex, sets) {
    var byDay = {};
    sets.filter(function (s) { return s.exercise === ex.id; }).forEach(function (s) {
      (byDay[s.day] = byDay[s.day] || []).push(s);
    });
    var pts = Object.keys(byDay).sort().map(function (d) {
      var list = byDay[d].sort(function (a, b) { return a.set_no - b.set_no; });
      var top = list.reduce(function (m, s) { return s.weight != null && s.weight > m ? s.weight : m; }, -1);
      var reps = list.map(function (s) { return s.reps == null ? "?" : s.reps; });
      return { day: d, top: top, reps: reps, detail: " × " + reps.join(", ") };
    }).filter(function (p) { return p.top >= 0; });
    return lineCard(ex.name, pts, { empty: "No sets logged yet.", pad: 5, cols: ["Date", "Top lb", "Reps"] });
  }

  /* ---- body weight check-ins ---- */

  function renderBody(daily, goal) {
    var pts = daily.filter(function (r) { return r.body_weight != null; })
      .map(function (r) { return { day: r.day, top: Number(r.body_weight) }; });
    var host = $("bodyweight");
    host.textContent = "";
    var card = lineCard(!pts.length ? "Weigh-ins" : pts.length + (pts.length === 1 ? " weigh-in" : " weigh-ins"), pts,
      { empty: "No weigh-ins yet. Add one from any day, or sync them from Apple Health.", pad: 2, decimals: true, cols: ["Date", "lb"] });

    // Goal line: latest weight against the goal, with a button to change it.
    var row = el("div", "goalrow");
    var txt = el("span", "small");
    var last = pts.length ? pts[pts.length - 1].top : null;
    if (goal == null) {
      txt.className = "muted small";
      txt.textContent = "No goal set.";
    } else {
      var left = last == null ? null : Math.round((last - goal) * 10) / 10;
      txt.appendChild(el("strong", null, "Goal " + goal + " lb"));
      txt.appendChild(document.createTextNode(
        left == null ? "" : left > 0 ? " · " + left + " lb to go" : " · reached"));
    }
    var btn = el("button", "link", goal == null ? "Set goal" : "Change");
    btn.type = "button";
    btn.addEventListener("click", function () {
      var v = prompt("Goal body weight (lb). Leave empty to clear.", goal == null ? "" : goal);
      if (v === null) return;
      var n = v.trim() === "" ? null : Number(v);
      if (n != null && !(n >= 50 && n <= 700)) { K.showError("Enter a weight between 50 and 700 lb."); return; }
      K.db.from("profile").upsert({ weight_goal: n, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .then(function (r) { if (r.error) throw r.error; renderBody(daily, n); })
        .catch(function (e) { K.showError(e.message || String(e)); });
    });
    row.append(txt, btn);
    card.insertBefore(row, card.children[1]);
    host.appendChild(card);
  }

  /* ---- steps: the last 14 days ---- */

  function renderSteps(daily) {
    var byDay = {};
    daily.forEach(function (r) { if (r.steps != null) byDay[r.day] = r.steps; });
    var t = P.parseDay(P.today());
    var days = [];
    for (var i = 13; i >= 0; i--) {
      var d = P.fmtDay(P.addDays(t, -i));
      days.push({ day: d, v: byDay[d] });
    }
    var host = $("steps");
    host.textContent = "";
    var head = el("div", "ex-head");
    head.appendChild(el("h3", null, "Last 14 days"));
    host.appendChild(head);
    var have = days.filter(function (d) { return d.v != null; });
    if (!have.length) {
      host.appendChild(el("p", "muted small", "No steps logged yet. Add them from Today on the calendar."));
      return;
    }
    var week = days.slice(7).filter(function (d) { return d.v != null; });
    var avg = week.length ? Math.round(week.reduce(function (s, d) { return s + d.v; }, 0) / week.length) : null;
    if (avg != null) head.appendChild(el("span", "target steps", avg.toLocaleString() + " avg / 7d"));

    var W = 320, H = 140, padL = 30, padB = 22, padT = 16;
    var max = Math.max.apply(null, have.map(function (d) { return d.v; }));
    max = Math.max(1000, Math.ceil(max / 2000) * 2000);
    var bw = (W - padL) / days.length;
    var y = function (v) { return H - padB - (v / max) * (H - padB - padT); };
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Steps per day: " + have.map(function (d) { return P.md(d.day) + " " + d.v; }).join(", ") });
    [0, max].forEach(function (v) {
      svg.appendChild(svgEl("line", { x1: padL, x2: W, y1: y(v), y2: y(v), class: "axis" }));
      var tl = svgEl("text", { x: padL - 6, y: y(v) + 4, class: "tick", "text-anchor": "end" });
      tl.textContent = v >= 1000 ? Math.round(v / 1000) + "k" : String(v);
      svg.appendChild(tl);
    });
    var note = el("p", "muted small chart-note", "Tap a day for details.");
    days.forEach(function (d, i) {
      var x = padL + i * bw + bw * 0.18, w = bw * 0.64;
      if (d.v != null && d.v > 0) {
        var top = y(d.v), h = y(0) - top, r = Math.min(3, h);
        svg.appendChild(svgEl("path", { class: "bar steps",
          d: "M" + x + "," + y(0) + "V" + (top + r) + "q0,-" + r + " " + r + ",-" + r +
             "H" + (x + w - r) + "q" + r + ",0 " + r + "," + r + "V" + y(0) + "Z" }));
      }
      if (i % 7 === 0 || i === days.length - 1) {
        var lab = svgEl("text", { x: x + w / 2, y: H - 6, class: "tick", "text-anchor": "middle" });
        lab.textContent = P.md(d.day);
        svg.appendChild(lab);
      }
      var show = function () { note.textContent = P.nice(d.day) + ": " + (d.v == null ? "not logged" : d.v.toLocaleString() + " steps"); };
      var hit = svgEl("rect", { x: padL + i * bw, y: padT, width: bw, height: H - padT - padB, class: "hit" });
      hit.addEventListener("pointerenter", show);
      hit.addEventListener("click", show);
      svg.appendChild(hit);
    });
    host.append(svg, note);
  }

  /* ---- steps: daily average per month, Jan 2026 on ---- */

  function renderMonthly(daily) {
    var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var sums = {};
    daily.forEach(function (r) {
      if (r.steps == null || r.day < "2026-01-01") return;
      var m = r.day.slice(0, 7);
      var g = sums[m] = sums[m] || { n: 0, total: 0 };
      g.n++; g.total += r.steps;
    });
    var months = Object.keys(sums).sort().slice(-12);
    var host = $("stepsmonthly");
    host.textContent = "";
    var head = el("div", "ex-head");
    head.appendChild(el("h3", null, "Daily average by month"));
    host.appendChild(head);
    if (!months.length) {
      host.appendChild(el("p", "muted small", "No steps yet. Set up Health sync from the account menu."));
      return;
    }
    var pts = months.map(function (m) {
      return { m: m, v: Math.round(sums[m].total / sums[m].n), n: sums[m].n };
    });
    var W = 320, H = 150, padL = 30, padB = 22, padT = 18;
    var max = Math.max(2000, Math.ceil(Math.max.apply(null, pts.map(function (p) { return p.v; })) / 2000) * 2000);
    var bw = (W - padL) / pts.length;
    var y = function (v) { return H - padB - (v / max) * (H - padB - padT); };
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Average steps per day by month: " + pts.map(function (p) { return p.m + " " + p.v; }).join(", ") });
    [0, max / 2, max].forEach(function (v) {
      svg.appendChild(svgEl("line", { x1: padL, x2: W, y1: y(v), y2: y(v), class: "axis" }));
      var tl = svgEl("text", { x: padL - 6, y: y(v) + 4, class: "tick", "text-anchor": "end" });
      tl.textContent = v ? Math.round(v / 1000) + "k" : "0";
      svg.appendChild(tl);
    });
    var note = el("p", "muted small chart-note", "Tap a month for details.");
    var best = pts.reduce(function (a, p) { return p.v > a.v ? p : a; }, pts[0]);
    pts.forEach(function (p, i) {
      var x = padL + i * bw + bw * 0.16, w = bw * 0.68;
      var top = y(p.v), h = y(0) - top, r = Math.min(4, h);
      svg.appendChild(svgEl("path", { class: "bar steps",
        d: "M" + x + "," + y(0) + "V" + (top + r) + "q0,-" + r + " " + r + ",-" + r +
           "H" + (x + w - r) + "q" + r + ",0 " + r + "," + r + "V" + y(0) + "Z" }));
      if (p === best || (i === pts.length - 1 && i - pts.indexOf(best) >= 2)) {
        var v = svgEl("text", { x: x + w / 2, y: top - 4, class: "val", "text-anchor": "middle" });
        v.textContent = (Math.round(p.v / 100) / 10) + "k";
        svg.appendChild(v);
      }
      var lab = svgEl("text", { x: x + w / 2, y: H - 6, class: "tick", "text-anchor": "middle" });
      lab.textContent = MON[Number(p.m.slice(5)) - 1].charAt(0);
      svg.appendChild(lab);
      var show = function () {
        note.textContent = MON[Number(p.m.slice(5)) - 1] + " " + p.m.slice(0, 4) + ": " +
          p.v.toLocaleString() + " steps a day (" + p.n + (p.n === 1 ? " day)" : " days)");
      };
      var hit = svgEl("rect", { x: padL + i * bw, y: padT, width: bw, height: H - padT - padB, class: "hit" });
      hit.addEventListener("pointerenter", show);
      hit.addEventListener("click", show);
      svg.appendChild(hit);
    });
    host.append(svg, note);
  }

  /* ---- other workouts: totals per kind ---- */

  function renderOthers(acts) {
    var host = $("others");
    host.textContent = "";
    if (!acts.length) {
      host.appendChild(el("p", "muted small", "Nothing yet. Add a walk, hike, yoga or your own from any day."));
      return;
    }
    var by = {};
    acts.forEach(function (a) {
      var g = by[a.name] = by[a.name] || { name: a.name, n: 0, min: 0, last: a.day };
      g.n++; g.min += a.minutes || 0;
      if (a.day > g.last) g.last = a.day;
    });
    var list = Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return b.min - a.min || b.n - a.n; });
    var top = Math.max(1, list[0].min);
    var total = list.reduce(function (s, g) { return s + g.min; }, 0);
    var head = el("div", "ex-head");
    head.append(el("h3", null, acts.length + (acts.length === 1 ? " session" : " sessions")),
      el("span", "target other", total + " min"));
    host.appendChild(head);
    list.forEach(function (g) {
      var row = el("div", "hbar");
      var lab = el("div", "hbar-lab");
      lab.append(el("strong", null, g.name),
        el("span", "muted small", g.n + "× · " + g.min + " min · last " + P.md(g.last)));
      var track = el("div", "hbar-track");
      var fill = el("i");
      fill.style.width = Math.max(2, g.min / top * 100) + "%";
      track.appendChild(fill);
      row.append(lab, track);
      host.appendChild(row);
    });
  }

  function load() {
    return Promise.all([
      K.db.from("sessions").select("day, kind, done, short, ride_minutes").eq("done", true),
      K.db.from("sets").select("day, exercise, set_no, weight, reps").order("day"),
      K.db.from("daily").select("day, steps, body_weight").order("day"),
      K.db.from("activities").select("day, name, minutes").order("day"),
      K.db.from("profile").select("weight_goal").maybeSingle()
    ]).then(function (res) {
      res.forEach(function (r) { if (r.error) throw r.error; });
      renderSteps(res[2].data || []);
      renderMonthly(res[2].data || []);
      var goal = res[4].data && res[4].data.weight_goal != null ? Number(res[4].data.weight_goal) : null;
      renderBody(res[2].data || [], goal);
      renderOthers(res[3].data || []);
      var done = res[0].data || [];
      var sets = (res[1].data || []).map(function (s) {
        s.weight = s.weight == null ? null : Number(s.weight);
        return s;
      });
      var counts = weekCounts(done);
      renderTiles(done, counts);
      renderWeekly(counts);
      var host = $("lifts");
      host.textContent = "";
      P.EXERCISES.forEach(function (ex) { host.appendChild(renderLift(ex, sets)); });
    });
  }

  K.ready.then(function () {
    load().catch(function (e) { K.showError(e.message || String(e)); });
  });
})();
