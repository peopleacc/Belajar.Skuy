import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

// Fitur BE — ambil daftar pertanyaan sesi wawancara. Dibaca LANGSUNG dari Supabase
// (bukan lewat Express): RLS "sesi sendiri dibaca" yang menjaga kepemilikan, jadi
// tidak perlu endpoint baru di service simulasi.
export async function GET(request: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId wajib disertakan." }, { status: 400 });
  }

  const { data } = await supabase
    .from("simulation_sessions")
    .select("context")
    .eq("id", sessionId)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ questions: data.context?.questions ?? [] });
}
