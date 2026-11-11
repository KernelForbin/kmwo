/* Supabase project for kmwo.
   Both values are public by design: the publishable key can only do what
   the row level security rules in supabase/migrations allow, which for
   anyone but the signed-in owner is nothing. NEVER put the secret key
   (sb_secret_...) or the database password here: this file is public. */
window.KMWO_CONFIG = {
  supabaseUrl: "https://uppookkvwbfvjoigytiz.supabase.co",
  supabasePublishableKey: "sb_publishable_79XRke-VUtSe1JExGDtdPg_-H1tI0Jb"
};
