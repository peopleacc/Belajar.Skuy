import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetchSimulation, expressErrorMessage } from "@/lib/api";

// Batas durasi fungsi di hosting (Vercel). Harus >= batas fetch ke Express
// (EXPRESS_TIMEOUT_MS di lib/api.ts) supaya bukan lapisan ini yang memutus duluan.
// CATATAN: nilai efektifnya dibatasi paket Vercel — Hobby maksimal 300 detik,
// jadi 600 hanya berlaku penuh di paket yang mengizinkannya.
export const maxDuration = 60;

// Fitur BD — picu penilaian sesi (dipanggil otomatis setelah selesai, dan oleh
// tombol "Nilai Ulang" di halaman hasil).
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

  const body = await request.json().catch(() => ({}));
  try {
    const res = await apiFetchSimulation("/api/simulation/score", {
      method: "POST",
      body: JSON.stringify({ userId: user.id, sessionId: body.sessionId }),
    });
    const data = await res.json().catch(() => ({ error: "Respons tidak valid dari API service." }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: expressErrorMessage(err, "npm run dev:simulation") }, { status: 502 });
  }
}
