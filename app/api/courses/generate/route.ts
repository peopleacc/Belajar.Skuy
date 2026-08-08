import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetch, expressErrorMessage } from "@/lib/api";

// Batas durasi fungsi di hosting (Vercel). Harus >= batas fetch ke Express
// (EXPRESS_TIMEOUT_MS di lib/api.ts) supaya bukan lapisan ini yang memutus duluan.
// CATATAN: nilai efektifnya dibatasi paket Vercel — Hobby maksimal 300 detik,
// jadi 600 hanya berlaku penuh di paket yang mengizinkannya.
export const maxDuration = 600;

// Jembatan aman ke service Express: user divalidasi di sini (session Supabase),
// lalu request diteruskan dengan x-internal-secret. Secret tidak pernah sampai ke browser.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";

  if (topic.length < 3) {
    return NextResponse.json({ error: "Topik minimal 3 karakter ya." }, { status: 400 });
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

  try {
    const res = await apiFetch("/api/curriculum/generate", {
      method: "POST",
      // Fitur DN — bahasa keluaran course. Divalidasi di sini juga (bukan cuma
      // di Express) supaya nilai asing tidak diteruskan begitu saja.
      body: JSON.stringify({
        topic,
        userId: user.id,
        language: body.language === "en" ? "en" : "id",
      }),
    });
    const data = await res.json().catch(() => ({
      error: "Respons tidak valid dari API service.",
    }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: expressErrorMessage(err) }, { status: 502 });
  }
}
