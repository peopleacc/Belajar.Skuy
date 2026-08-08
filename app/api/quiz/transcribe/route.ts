import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetchForm, expressErrorMessage } from "@/lib/api";

// Batas durasi fungsi di hosting (Vercel). Harus >= batas fetch ke Express
// (EXPRESS_TIMEOUT_MS di lib/api.ts) supaya bukan lapisan ini yang memutus duluan.
// CATATAN: nilai efektifnya dibatasi paket Vercel — Hobby maksimal 300 detik,
// jadi 600 hanya berlaku penuh di paket yang mengizinkannya.
export const maxDuration = 600;

const MAX_BYTES = 10 * 1024 * 1024; // Fitur R — 10MB

// Fitur R — proxy transkripsi audio jawaban esai-suara. Audio TIDAK disimpan di Supabase —
// cuma diteruskan ke Express untuk ditranskrip, lalu dibuang begitu respons balik.
export async function POST(request: Request) {
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

  const incoming = await request.formData().catch(() => null);
  const audio = incoming?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "File audio wajib disertakan." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File audio terlalu besar (maksimal 10MB)." },
      { status: 413 }
    );
  }

  const outgoing = new FormData();
  outgoing.append("audio", audio, audio.name || "rekaman.webm");
  // Fitur CC — dari SESI server, bukan dari kiriman browser. Express memakainya
  // untuk memeriksa apakah paket user mencakup fitur latihan suara.
  outgoing.append("userId", user.id);

  try {
    const res = await apiFetchForm("/api/quiz/transcribe", outgoing);
    const data = await res.json().catch(() => ({ error: "Respons tidak valid dari API service." }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: expressErrorMessage(err) }, { status: 502 });
  }
}
