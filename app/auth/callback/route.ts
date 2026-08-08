import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordLogin } from "@/lib/loginEvents";

// Tujuan redirect OAuth (Google) & konfirmasi email.
// Daftarkan http://localhost:3000/auth/callback di Supabase Auth → URL Configuration.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Fitur DI — default ke /portal (user pilih mode dulu). Parameter `next`
  // eksplisit tetap dihormati kalau pemanggil memang menuju halaman tertentu.
  const next = searchParams.get("next") ?? "/portal";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) await recordLogin(supabase, data.user.id); // Fitur DM
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
