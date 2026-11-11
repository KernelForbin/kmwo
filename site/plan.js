/* The 8-week plan, Nov 16 2026 to Jan 10 2027 (Mon to Sun). */
window.KMWO_PLAN = (function () {
  "use strict";

  var START = "2026-11-16"; // a Monday
  var WEEKS = 8;
  // Weekday index, Monday = 0. ASSUMPTION: Mon/Wed/Fri. Edit to match your week.
  var SCHEDULE = { 0: "lift", 2: "ride", 4: "lift" };
  var DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

  function describe(kind, week) {
    if (kind === "lift") {
      var sets = week <= 2 ? 2 : 3;
      return "Goblet squat, dumbbell bench press, one-arm row (each side): " + sets + " sets of 10";
    }
    return week <= 2 ? "Peloton, 20 min, low impact" : "Peloton, 30 min, low impact or endurance";
  }

  return {
    START: START, WEEKS: WEEKS, SCHEDULE: SCHEDULE, DAY_NAMES: DAY_NAMES,
    parseDay: parseDay, fmtDay: fmtDay, addDays: addDays, describe: describe
  };
})();
