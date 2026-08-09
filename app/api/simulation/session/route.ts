import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetchSimulation, expressErrorMessage } from "@/lib/api";

// Batas durasi fungsi di hosting (Vercel). Harus >= batas fetch ke Express
// (EXPRESS_TIMEOUT_MS di lib/api.ts) supaya bukan lapisan ini yang memutus duluan.
// CATATAN: nilai efektifnya dibatasi paket Vercel — Hobby maksimal 300 detik,
// jadi 600 hanya berlaku penuh di paket yang mengizinkannya.
export const maxDuration = 60;

// Fitur BB — buat sesi simulasi. userId dari SESI server (bukan kiriman browser);
// kuota sesi ditegakkan di Express (entitlements.js).
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

  // Fitur BE — proxy ini SEMPAT hardcode type:"presentation" dari Batch 1 (BB) dan
  // tak ikut diperbarui saat wawancara ditambah (Batch 3) → permintaan wawancara
  // apa pun selalu dikirim ulang sebagai presentasi tanpa slide, ditolak Express
  // dengan pesan yang membingungkan ("Teks slide wajib disertakan"). Sekarang
  // type & context diteruskan apa adanya dari body; Express sendiri yang
  // memvalidasi per tipe (slides utk presentasi, context utk wawancara).
  const body = await request.json().catch(() => ({}));
  const type = body.type === "interview" ? "interview" : "presentation";
  try {
    const res = await apiFetchSimulation("/api/simulation/session", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        type,
        slides: body.slides,
        context: body.context,
        settings: body.settings,
      }),
    });
    const data = await res.json().catch(() => ({ error: "Respons tidak valid dari API service." }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: expressErrorMessage(err, "npm run dev:simulation") }, { status: 502 });
  }
}
