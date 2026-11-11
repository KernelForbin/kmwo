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

  /* ---- top set weight per lift ---- */

  function renderLift(ex, sets) {
    var byDay = {};
    sets.filter(function (s) { return s.exercise === ex.id; }).forEach(function (s) {
      (byDay[s.day] = byDay[s.day] || []).push(s);
    });
    var pts = Object.keys(byDay).sort().map(function (d) {
      var list = byDay[d].sort(function (a, b) { return a.set_no - b.set_no; });
      var top = list.reduce(function (m, s) { return s.weight != null && s.weight > m ? s.weight : m; }, -1);
      return { day: d, top: top, reps: list.map(function (s) { return s.reps == null ? "?" : s.reps; }) };
    }).filter(function (p) { return p.top >= 0; });

    var card = el("div", "card chart");
    var head = el("div", "ex-head");
    head.appendChild(el("h3", null, ex.name));
    card.appendChild(head);
    if (!pts.length) {
      card.appendChild(el("p", "muted small", "No sets logged yet."));
      return card;
    }

    if (pts.length > 1) {
      var delta = pts[pts.length - 1].top - pts[0].top;
      head.appendChild(el("span", "target", (delta >= 0 ? "+" : "") + delta + " lb"));
    }
    var W = 320, H = 130, padL = 34, padR = 40, padT = 12, padB = 20;
    var lo = Math.min.apply(null, pts.map(function (p) { return p.top; }));
    var hi = Math.max.apply(null, pts.map(function (p) { return p.top; }));
    if (hi === lo) { lo = Math.max(0, lo - 5); hi = hi + 5; }
    var x = function (i) { return pts.length === 1 ? (padL + W - padR) / 2 : padL + i * (W - padL - padR) / (pts.length - 1); };
    var y = function (v) { return H - padB - (v - lo) / (hi - lo) * (H - padT - padB); };

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": ex.name + " top set weight: " + pts.map(function (p) { return P.md(p.day) + " " + p.top + " lb"; }).join(", ") });
    [lo, hi].forEach(function (v) {
      svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: "axis" }));
      var t = svgEl("text", { x: padL - 6, y: y(v) + 4, class: "tick", "text-anchor": "end" });
      t.textContent = Math.round(v);
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
      var show = function () { note.textContent = P.md(p.day) + ": " + p.top + " lb × " + p.reps.join(", "); };
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
    ["Date", "Top lb", "Reps"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    table.appendChild(hr);
    pts.forEach(function (p) {
      var tr = el("tr");
      tr.append(el("td", null, P.md(p.day)), el("td", null, String(p.top)), el("td", null, p.reps.join(", ")));
      table.appendChild(tr);
    });
    det.appendChild(table);
    card.appendChild(det);
    return card;
  }

  function load() {
    return Promise.all([
      K.db.from("sessions").select("day, kind, done, short, ride_minutes").eq("done", true),
      K.db.from("sets").select("day, exercise, set_no, weight, reps").order("day")
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      if (res[1].error) throw res[1].error;
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
