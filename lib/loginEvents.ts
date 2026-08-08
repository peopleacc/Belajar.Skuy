import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fitur DM (planning-update-11) — dicatat di TITIK LOGIN sungguhan (bukan
 * tiap request) supaya chart "kapan user login" di admin-dashboard mewakili
 * aksi login asli, bukan aktivitas browsing biasa. Dipanggil dari tiga jalur
 * masuk: email/password (login), setelah daftar (register), dan Google/
 * konfirmasi email (auth/callback).
 *
 * Gagal mencatat TIDAK BOLEH menggagalkan login itu sendiri — ini cuma
 * telemetri untuk dashboard internal, bukan bagian dari alur inti.
 */
export async function recordLogin(supabase: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  try {
    await Promise.all([
      supabase.from("profiles").update({ last_seen_at: now }).eq("id", userId),
      supabase.from("login_events").insert({ user_id: userId, occurred_at: now }),
    ]);
  } catch {
    /* telemetri opsional — jangan sampai login pengguna ikut gagal */
  }
}
