/* kmwo: sign-in gate. Every page loads this before its own script.

   Nothing but the sign-in card shows, and no data is fetched, until the
   visitor is signed in with Google. The data itself is protected by row
   level security (user_id = auth.uid()), so this gate is not the only lock.

   Each page has <main id="gate"> (with #gate-msg and #signin) and
   <main id="app" hidden>; this file shows #app once signed in.

   Exposes window.KMWO:
     db         the supabase client
     ready      Promise, resolves with the session once signed in
     signOut    ()
     showError  (text) shows or clears the page's #err line */
(function () {
  "use strict";

  var cfg = window.KMWO_CONFIG || {};
  var gate = document.getElementById("gate");
  var msg = document.getElementById("gate-msg");
  var btn = document.getElementById("signin");

  var resolveReady;
  var KMWO = window.KMWO = {
    db: null,
    ready: new Promise(function (r) { resolveReady = r; }),
    signOut: null,
    showError: function (text) {
      var e = document.getElementById("err");
      if (!e) return;
      e.textContent = text || "";
      e.hidden = !text;
    }
  };

  function showSignIn(text) {
    msg.textContent = text || "Private workout tracker";
    btn.hidden = false;
    gate.hidden = false;
  }

  if (!window.supabase || !window.supabase.createClient) {
    msg.textContent = "Couldn't load the sign-in library. Check your connection and reload.";
    return;
  }

  var db = KMWO.db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  var opened = false;

  KMWO.signOut = function () { return db.auth.signOut(); };

  btn.addEventListener("click", function () {
    btn.disabled = true;
    db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: location.origin + location.pathname,
        queryParams: { prompt: "select_account" }
      }
    }).then(function (res) {
      if (res.error) {
        btn.disabled = false;
        showSignIn(res.error.message);
      }
    });
  });

  db.auth.onAuthStateChange(function (event, session) {
    if (session) {
      if (opened) return;
      opened = true;
      gate.hidden = true;
      document.getElementById("app").hidden = false;
      var so = document.getElementById("signout");
      if (so) so.addEventListener("click", KMWO.signOut);
      resolveReady(session);
    } else if (opened) {
      location.reload(); // signed out: back to the sign-in card
    }
  });

  db.auth.getSession().then(function (res) {
    if (!res.data.session) showSignIn();
  });
})();
