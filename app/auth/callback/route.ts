import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordLogin } from "@/lib/loginEvents";
import { getAppUrl } from "@/lib/url";

// Tujuan redirect OAuth (Google) & konfirmasi email.
// Daftarkan https://<domain-kamu>/auth/callback dan http://localhost:3000/auth/callback di Supabase Auth → URL Configuration.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Default ke /portal (user pilih mode dulu)
  const next = searchParams.get("next") ?? "/portal";
  const safeNext = next.startsWith("/") ? next : `/${next}`;

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
    if (!error) {
      if (data.user) await recordLogin(supabase, data.user.id); // Fitur DM
      return NextResponse.redirect(`${baseUrl}${safeNext}`);
    } else {
      console.error("Auth callback exchangeCodeForSession failed:", error.message);
    }
  }

  return NextResponse.redirect(`${baseUrl}/login?error=auth_callback`);
}
