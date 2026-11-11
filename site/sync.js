/* kmwo: Health sync setup. Shows the last sync, makes a sync key (shown
   once), and fills in the URL and public key the Shortcut needs. */
(function () {
  "use strict";

  var K = window.KMWO;
  var P = window.KMWO_PLAN;
  var cfg = window.KMWO_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  function ago(iso) {
    var d = new Date(iso);
    var mins = Math.round((Date.now() - d) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    var day = P.fmtDay(d);
    var t = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return (P.nice(day) === "Today" ? "today" : P.nice(day)) + " at " + t;
  }

  function renderStatus(row) {
    var host = $("status");
    host.textContent = "";
    var h = document.createElement("h3");
    var p = document.createElement("p");
    p.className = "muted small";
    if (!row) {
      h.textContent = "Not set up yet";
      p.textContent = "Create a sync key, then build the Shortcut below.";
    } else if (!row.last_used) {
      h.textContent = "Waiting for the first sync";
      p.textContent = "Key created " + ago(row.created_at) + ". Run the Shortcut once to test it.";
    } else {
      var r = row.last_result || {};
      h.textContent = "Last synced " + ago(row.last_used);
      var bits = [];
      if (r.steps_days != null) bits.push(r.steps_days + (r.steps_days === 1 ? " day" : " days") + " of steps");
      if (r.weigh_ins) bits.push(r.weigh_ins + (r.weigh_ins === 1 ? " weigh-in" : " weigh-ins"));
      if (r.workouts != null) bits.push(r.workouts + (r.workouts === 1 ? " workout" : " workouts"));
      if (r.skipped) bits.push(r.skipped + " skipped (logged as Lift or Ride)");
      p.textContent = bits.join(" · ");
    }
    host.append(h, p);
    $("makekey").textContent = row ? "Replace sync key" : "Create sync key";
    $("makekey").className = row ? "" : "primary";
  }

  function load() {
    return K.db.from("sync_keys").select("created_at, last_used, last_result").maybeSingle()
      .then(function (r) { if (r.error) throw r.error; renderStatus(r.data); });
  }

  function makeKey() {
    var replacing = $("makekey").textContent.indexOf("Replace") === 0;
    if (replacing && !confirm("Make a new key? The Shortcut will stop syncing until you paste the new one in.")) return;
    $("makekey").disabled = true;
    K.showError("");
    K.db.rpc("create_sync_key").then(function (r) {
      $("makekey").disabled = false;
      if (r.error) throw r.error;
      $("key").textContent = r.data;
      $("keybox").hidden = false;
      return load();
    }).catch(function (e) {
      $("makekey").disabled = false;
      K.showError(e.message || String(e));
    });
  }

  K.ready.then(function () {
    $("url").textContent = cfg.supabaseUrl + "/rest/v1/rpc/health_sync";
    $("apikey").textContent = cfg.supabasePublishableKey;
    document.querySelectorAll("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var text = $(b.dataset.copy).textContent;
        var done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { b.textContent = "Select it"; });
      });
    });
    $("makekey").addEventListener("click", makeKey);
    load().catch(function (e) { K.showError(e.message || String(e)); });
  });
})();
