import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetch, expressErrorMessage } from "@/lib/api";
import { stripEssaySecrets } from "@/lib/quiz";

// Batas durasi fungsi di hosting (Vercel). Harus >= batas fetch ke Express
// (EXPRESS_TIMEOUT_MS di lib/api.ts) supaya bukan lapisan ini yang memutus duluan.
// CATATAN: nilai efektifnya dibatasi paket Vercel — Hobby maksimal 300 detik,
// jadi 600 hanya berlaku penuh di paket yang mengizinkannya.
export const maxDuration = 600;

// Fitur J — generate SOAL bab (lazy, grounded ke materi). Dipanggil saat user menuju Ujian.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const contentId = typeof body.contentId === "string" ? body.contentId : "";
  const regenerate = body.regenerate === true;

  if (!contentId) {
    return NextResponse.json({ error: "contentId wajib disertakan." }, { status: 400 });
  }
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

  // RLS: kalau bab bukan milik user, select kosong
  const { data: owned } = await supabase
    .from("contents")
    .select("id")
    .eq("id", contentId)
    .maybeSingle();
  if (!owned) {
    return NextResponse.json({ error: "Bab tidak ditemukan." }, { status: 404 });
  }

  try {
    const res = await apiFetch("/api/content/quiz", {
      method: "POST",
      body: JSON.stringify({ contentId, regenerate }),
    });
    const data = await res.json().catch(() => ({ error: "Respons tidak valid dari API service." }));
    // Fitur Q — kunci jawaban esai tidak boleh sampai ke browser (respons ini langsung ke fetch() client).
    if (data?.quiz?.questions) {
      data.quiz.questions = stripEssaySecrets(data.quiz.questions);
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: expressErrorMessage(err) }, { status: 502 });
  }
}
