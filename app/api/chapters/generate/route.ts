import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetch, expressErrorMessage } from "@/lib/api";

// Batas durasi fungsi di hosting (Vercel). Harus >= batas fetch ke Express
// (EXPRESS_TIMEOUT_MS di lib/api.ts) supaya bukan lapisan ini yang memutus duluan.
// CATATAN: nilai efektifnya dibatasi paket Vercel — Hobby maksimal 300 detik,
// jadi 600 hanya berlaku penuh di paket yang mengizinkannya.
export const maxDuration = 120;

// Generate materi satu bab (Modul 5; soal digenerate terpisah sejak Fitur J).
// Fitur X — dipakai juga untuk GENERATE ULANG bab (`regenerate` + `instruction`).
// Kepemilikan dicek lewat RLS: kalau bab bukan milik user, select di bawah kosong.
// Track 13 — Bebas generate bab mana saja (Non-Linear Chapter Generation) tanpa terhambat status locked.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const contentId = typeof body.contentId === "string" ? body.contentId : "";
  const options = body.options ?? undefined; // Fitur L — setting generate (opsional)
  const regenerate = body.regenerate === true; // Fitur X
  const instruction = typeof body.instruction === "string" ? body.instruction : undefined;

  if (!contentId) {
    return NextResponse.json({ error: "contentId wajib disertakan." }, { status: 400 });
  }
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

  const { data: owned } = await supabase
    .from("contents")
    .select("id, module_id")
    .eq("id", contentId)
    .maybeSingle();
  if (!owned) {
    return NextResponse.json({ error: "Bab tidak ditemukan." }, { status: 404 });
  }

  // Track 13: Pelepasan gate sekuensial lama. Pengguna berhak meng-generate materi
  // bab mana pun dalam modul miliknya secara langsung. Kuota harian (chapterGenerationsPerDay)
  // tetap ditegakkan secara aman oleh Express backend service.
  try {
    const res = await apiFetch("/api/content/generate", {
      method: "POST",
      body: JSON.stringify({ contentId, options, regenerate, instruction }),
    });
    const data = await res.json().catch(() => ({
      error: "Respons tidak valid dari API service.",
    }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: expressErrorMessage(err) }, { status: 502 });
  }
}
