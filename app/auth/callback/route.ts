import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordLogin } from "@/lib/loginEvents";
import { getAppUrl, sanitizeInternalUrl } from "@/lib/url";

// Tujuan redirect OAuth (Google) & konfirmasi email.
// Daftarkan https://<domain-kamu>/auth/callback dan http://localhost:3000/auth/callback di Supabase Auth → URL Configuration.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const flow = searchParams.get("flow") ?? "signin"; // "signin" | "signup"
  // Task 15A-AS: Sanitasi parameter redirect 'next' (Anti-Open-Redirect & Anti-XSS)
  const safeNext = sanitizeInternalUrl(searchParams.get("next"), "/portal");

  // Tentukan Base URL pengalihan yang akurat
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const isLocalEnv = process.env.NODE_ENV === "development";

  const baseUrl = isLocalEnv
    ? origin
    : forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : getAppUrl();

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const user = data.user;

      // Task 15A-AS (F02 Remediation):
      // Hapus penghapusan akun otomatis berdasarkan umur <20 detik yang sebelumnya
      // berisiko fatal menghapus akun pengguna sah saat latensi jaringan tinggi.
      await recordLogin(supabase, user.id); // Fitur DM

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      // Jika pendaftaran baru via Google atau profil belum menyelesaikan onboarding
      if (flow === "signup" || !profile || profile.onboarding_completed === false) {
        return NextResponse.redirect(`${baseUrl}/onboarding`);
      }

      return NextResponse.redirect(`${baseUrl}${safeNext}`);
    } else if (error) {
      console.error("Auth callback exchangeCodeForSession failed:", error.message);
    }
  }

  return NextResponse.redirect(`${baseUrl}/login?error=auth_callback`);
}
