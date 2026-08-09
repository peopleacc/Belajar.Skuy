import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetchForm, expressErrorMessage } from "@/lib/api";
import { stripEssaySecrets } from "@/lib/quiz";

// Batas durasi fungsi di hosting (Vercel). Harus >= batas fetch ke Express
// (EXPRESS_TIMEOUT_MS di lib/api.ts) supaya bukan lapisan ini yang memutus duluan.
// CATATAN: nilai efektifnya dibatasi paket Vercel — Hobby maksimal 300 detik,
// jadi 600 hanya berlaku penuh di paket yang mengizinkannya.
export const maxDuration = 60;

// Kuis kustom (Modul 10): teruskan teks bebas atau file PDF ke Express.
export async function POST(request: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase belum dikonfigurasi (next/.env.local)." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });
  }

  const incoming = await request.formData().catch(() => null);
  if (!incoming) {
    return NextResponse.json({ error: "Form tidak valid." }, { status: 400 });
  }

  const text = incoming.get("text");
  const file = incoming.get("file");
  const contentIdsRaw = incoming.get("contentIds");
  const questionCountRaw = incoming.get("questionCount");
  const quizTypesRaw = incoming.get("quizTypes"); // Fitur S

  const outgoing = new FormData();
  outgoing.append("userId", user.id);
  if (typeof questionCountRaw === "string" && questionCountRaw.trim()) {
    outgoing.append("questionCount", questionCountRaw);
  }
  if (typeof quizTypesRaw === "string" && quizTypesRaw.trim()) {
    outgoing.append("quizTypes", quizTypesRaw);
  }

  // Fitur N — sumber "dari materi saya" (pilih bab course yang sudah digenerate).
  let contentIds: string[] = [];
  if (typeof contentIdsRaw === "string" && contentIdsRaw.trim()) {
    try {
      const parsed = JSON.parse(contentIdsRaw);
      if (Array.isArray(parsed)) {
        contentIds = parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
      }
    } catch {
      return NextResponse.json({ error: "Format contentIds tidak valid." }, { status: 400 });
    }
  }
  if (contentIds.length > 3) {
    return NextResponse.json(
      { error: "Pilih maksimal 3 bab ya, materinya kepanjangan." },
      { status: 400 }
    );
  }
  if (contentIds.length > 0) {
    // WAJIB: verifikasi kepemilikan lewat RLS di sini — Express pakai service-role yang
    // bypass RLS, jadi kepemilikan harus sudah dipastikan sebelum sampai ke sana.
    const { data: owned } = await supabase.from("contents").select("id").in("id", contentIds);
    if (!owned || owned.length !== contentIds.length) {
      return NextResponse.json({ error: "Salah satu bab tidak ditemukan." }, { status: 404 });
    }
    outgoing.append("contentIds", JSON.stringify(contentIds));
  }

  if (typeof text === "string" && text.trim()) outgoing.append("text", text);
  if (file instanceof File && file.size > 0) outgoing.append("file", file, file.name);

  if (!outgoing.has("contentIds") && !outgoing.has("text") && !outgoing.has("file")) {
    return NextResponse.json(
      { error: "Isi teks materi, unggah PDF, atau pilih bab dari materimu dulu ya." },
      { status: 400 }
    );
  }

  try {
    const res = await apiFetchForm("/api/quiz/custom", outgoing);
    const data = await res.json().catch(() => ({
      error: "Respons tidak valid dari API service.",
    }));
    // Fitur Q — kunci jawaban esai tidak boleh sampai ke browser.
    if (data?.quiz?.questions) {
      data.quiz.questions = stripEssaySecrets(data.quiz.questions);
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: expressErrorMessage(err) }, { status: 502 });
  }
}
