/* kmwo: sign-in gate.

   Loaded before app.js. Nothing but the sign-in card shows, and no data is
   fetched, until the visitor is signed in with Google. The data itself is
   protected by row level security (user_id = auth.uid()), so this gate is
   not the only lock.

   Exposes window.KMWO:
     db       the supabase client
     ready    Promise, resolves with the session once signed in
     signOut  () */
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
    signOut: null
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

  KMWO.signOut = function () {
    return db.auth.signOut();
  };

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
      resolveReady(session);
    } else if (opened) {
      location.reload(); // signed out: back to the sign-in card
    }
  });

  db.auth.getSession().then(function (res) {
    if (!res.data.session) showSignIn();
  });
})();
