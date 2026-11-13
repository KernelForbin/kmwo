/* The 8-week plan, Wed Nov 11 2026 to Tue Jan 5 2027, and the date
   helpers every page shares. Pure data and functions, no network. */
window.KMWO_PLAN = (function () {
  "use strict";

  var START = "2026-11-11"; // a Wednesday, the first Ride
  var WEEKS = 8;
  // Session days, weekday index with Monday = 0: Mon, Wed, Fri.
  var SESSION_DAYS = [0, 2, 4];
  // Sessions alternate Ride, Lift, Ride, Lift... across the session days
  // (Wed Ride, Fri Lift, Mon Ride, Wed Lift, Fri Ride...). A missed day
  // doesn't skip one: the next session done is the next in this sequence.
  var PATTERN = ["ride", "lift"];
  var TOTAL = WEEKS * SESSION_DAYS.length;
  var DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  var EXERCISES = [
    { id: "goblet_squat", name: "Goblet squat" },
    { id: "bench", name: "Dumbbell bench press" },
    { id: "row", name: "One-arm dumbbell row", note: "each side" }
  ];
  var RIDE_TYPES = ["Low impact", "Endurance", "HIIT", "Tabata", "Power Zone", "Other"];
  // Starter list for "other" workouts. Names you type yourself are saved
  // (workout_types table) and offered next to these.
  var OTHER_WORKOUTS = ["Walk", "Run", "Hike", "Yoga", "Stretching", "Swim", "Sports"];

  function parseDay(s) {
    var p = s.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2], 12);
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function fmtDay(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function addDays(d, n) {
    var x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }
  function today() { return fmtDay(new Date()); }
  function isDay(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || "") && fmtDay(parseDay(s)) === s; }

  var END = fmtDay(addDays(parseDay(START), WEEKS * 7 - 1));
  function inPlan(day) { return day >= START && day <= END; }
  function weekday(day) { return (parseDay(day).getDay() + 6) % 7; }
  // Planned kind for each session day in the plan, in order.
  var SCHEDULE = {};
  (function () {
    var n = 0;
    for (var i = 0; i < WEEKS * 7; i++) {
      var day = fmtDay(addDays(parseDay(START), i));
      if (SESSION_DAYS.indexOf(weekday(day)) !== -1) SCHEDULE[day] = PATTERN[n++ % PATTERN.length];
    }
  })();
  function plannedKind(day) { return SCHEDULE[day]; }

  // Plan week 1-8 for a day; days before the plan count as week 1, after as 8.
  function weekOf(day) {
    var diff = Math.round((parseDay(day) - parseDay(START)) / 864e5);
    return Math.min(WEEKS, Math.max(1, Math.floor(diff / 7) + 1));
  }

  function setsFor() { return 3; } // 3 sets every week (was 2 in weeks 1-2)
  function rideMinutes(week) { return week <= 2 ? 20 : 30; }

  function liftText(week) {
    return "Goblet squat, dumbbell bench press, one-arm row (each side): " + setsFor(week) + " sets of 10";
  }
  function rideText(week) {
    return week <= 2 ? "Peloton, 20 min, low impact" : "Peloton, 30 min, low impact or endurance";
  }
  function describe(kind, week) { return kind === "lift" ? liftText(week) : rideText(week); }

  function scheduledDays() {
    var out = [];
    for (var i = 0; i < WEEKS * 7; i++) {
      var day = fmtDay(addDays(parseDay(START), i));
      if (plannedKind(day)) out.push(day);
    }
    return out;
  }

  /* What to do next, given the days with a done session and the days marked
     skipped. Kind: the next in the sequence (a skip doesn't move it). When:
     today if today is a planned day not yet done or skipped, or if you're
     behind (fewer done than planned-and-not-skipped so far); otherwise the
     next planned day not skipped. Returns null once all sessions are done. */
  function nextUp(doneDays, skippedDays) {
    var t = today();
    var done = doneDays.filter(inPlan);
    var skipped = (skippedDays || []).filter(inPlan);
    if (done.length >= TOTAL) return null;
    var kind = PATTERN[done.length % PATTERN.length];
    var planned = scheduledDays().filter(function (d) { return skipped.indexOf(d) === -1; });
    var when;
    if (t < START) {
      when = planned[0] || START;
    } else {
      var handled = done.indexOf(t) !== -1 || skipped.indexOf(t) !== -1;
      var plannedBefore = planned.filter(function (d) { return d < t; }).length;
      var doneBefore = done.filter(function (d) { return d < t; }).length;
      if (!handled && (plannedKind(t) || plannedBefore > doneBefore)) {
        when = t;
      } else {
        when = planned.find(function (d) { return d > t; }) || fmtDay(addDays(parseDay(t), 1));
      }
    }
    return { kind: kind, day: when, week: weekOf(when), number: done.length + 1 };
  }

  /* The planned day a one-tap "Skip" applies to: the next-up day if it's a
     planned day, else (you're behind) the latest missed planned day. */
  function skipTarget(doneDays, skippedDays) {
    var n = nextUp(doneDays, skippedDays);
    if (!n) return null;
    var open = function (d) { return doneDays.indexOf(d) === -1 && (skippedDays || []).indexOf(d) === -1; };
    if (plannedKind(n.day) && open(n.day)) return n.day;
    var t = today();
    return scheduledDays().filter(function (d) { return d < t && open(d); }).pop() || null;
  }

  function label(kind) { return kind === "lift" ? "Lift" : "Ride"; }
  function md(day) { var d = parseDay(day); return (d.getMonth() + 1) + "/" + d.getDate(); }
  function nice(day) {
    var t = today();
    if (day === t) return "Today";
    if (day === fmtDay(addDays(parseDay(t), 1))) return "Tomorrow";
    return DAY_NAMES[weekday(day)] + " " + md(day);
  }

  return {
    START: START, END: END, WEEKS: WEEKS, SCHEDULE: SCHEDULE, PATTERN: PATTERN, TOTAL: TOTAL,
    DAY_NAMES: DAY_NAMES, EXERCISES: EXERCISES, RIDE_TYPES: RIDE_TYPES, OTHER_WORKOUTS: OTHER_WORKOUTS,
    parseDay: parseDay, fmtDay: fmtDay, addDays: addDays, today: today, isDay: isDay,
    inPlan: inPlan, weekday: weekday, plannedKind: plannedKind, weekOf: weekOf,
    setsFor: setsFor, rideMinutes: rideMinutes, describe: describe,
    scheduledDays: scheduledDays, nextUp: nextUp, skipTarget: skipTarget, label: label, md: md, nice: nice
  };
})();
