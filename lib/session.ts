import { createClient, supabaseConfigured } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  /** Kode paket yang BERLAKU sekarang ('free' | 'premium' | 'pro' | …). */
  planCode: string;
};

/**
 * Fitur BG + CA — profil user untuk halaman yang perlu tahu "siapa yang sedang login"
 * (portal, navbar publik, halaman harga). Dikumpulkan di satu tempat supaya beberapa
 * halaman tidak menulis query yang sama lalu berbeda sendiri.
 *
 * Paket dibaca dari tabel `subscriptions`, BUKAN lagi `profiles.subscription_status`
 * (kolom itu kini dipensiunkan dan hak tulisnya sudah dicabut di migration 006).
 *
 * Masa berlaku DIEVALUASI SAAT DIBACA, bukan lewat cron: kalau penurunan paket
 * bergantung pada job terjadwal, maka setiap kali job itu gagal jalan ada user yang
 * tetap menikmati paket berbayar melewati masanya — dan kegagalannya senyap.
 *
 * Tidak punya baris `subscriptions` = paket `free`. Sengaja begitu supaya user baru
 * tidak perlu di-backfill dan tidak ada yang bocor karena terlewat.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!supabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, full_name, avatar_url")
      .eq("id", user.id)
      .single(),
    supabase
      .from("subscriptions")
      .select("plan_code, status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const belumLewat =
    !sub?.current_period_end || new Date(sub.current_period_end).getTime() > Date.now();
  const aktif = !!sub && sub.status === "active" && belumLewat;

  return {
    id: user.id,
    username: profile?.username ?? user.email?.split("@")[0] ?? "user",
    fullName: profile?.full_name ?? "",
    avatarUrl: profile?.avatar_url ?? null,
    planCode: aktif ? sub.plan_code : "free",
  };
}
