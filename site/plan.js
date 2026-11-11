/* The 8-week plan, Nov 16 2026 to Jan 10 2027 (Mon to Sun), and the date
   helpers every page shares. Pure data and functions, no network. */
window.KMWO_PLAN = (function () {
  "use strict";

  var START = "2026-11-16"; // a Monday
  var WEEKS = 8;
  // Weekday index, Monday = 0. ASSUMPTION: Mon/Wed/Fri. Edit to match your week.
  var SCHEDULE = { 0: "lift", 2: "ride", 4: "lift" };
  // The order sessions come in. A missed day doesn't skip one: the next
  // session done is the next in this sequence ("pick up the sequence after").
  var PATTERN = ["lift", "ride", "lift"];
  var TOTAL = WEEKS * PATTERN.length;
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
  function plannedKind(day) { return inPlan(day) ? SCHEDULE[weekday(day)] : undefined; }

  // Plan week 1-8 for a day; days before the plan count as week 1, after as 8.
  function weekOf(day) {
    var diff = Math.round((parseDay(day) - parseDay(START)) / 864e5);
    return Math.min(WEEKS, Math.max(1, Math.floor(diff / 7) + 1));
  }

  function setsFor(week) { return week <= 2 ? 2 : 3; }
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

  /* What to do next, given the days with a done session.
     Kind: the next in the sequence. When: today if today is a planned day,
     or if you're behind (fewer done than planned so far); otherwise the next
     planned day. Returns null once all 24 are done. */
  function nextUp(doneDays) {
    var t = today();
    var done = doneDays.filter(inPlan);
    if (done.length >= TOTAL) return null;
    var kind = PATTERN[done.length % PATTERN.length];
    var planned = scheduledDays();
    var when;
    if (t < START) {
      when = START;
    } else {
      var todayDone = done.indexOf(t) !== -1;
      var plannedBefore = planned.filter(function (d) { return d < t; }).length;
      var doneBefore = done.filter(function (d) { return d < t; }).length;
      if (!todayDone && (plannedKind(t) || plannedBefore > doneBefore)) {
        when = t;
      } else {
        when = planned.find(function (d) { return d > t; }) || fmtDay(addDays(parseDay(t), 1));
      }
    }
    return { kind: kind, day: when, week: weekOf(when), number: done.length + 1 };
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
    scheduledDays: scheduledDays, nextUp: nextUp, label: label, md: md, nice: nice
  };
})();
