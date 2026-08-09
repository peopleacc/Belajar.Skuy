import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetch, expressErrorMessage } from "@/lib/api";

// Batas durasi fungsi di hosting (Vercel). Harus >= batas fetch ke Express
// (EXPRESS_TIMEOUT_MS di lib/api.ts) supaya bukan lapisan ini yang memutus duluan.
// CATATAN: nilai efektifnya dibatasi paket Vercel — Hobby maksimal 300 detik,
// jadi 600 hanya berlaku penuh di paket yang mengizinkannya.
export const maxDuration = 60;

// Proxy streaming chatbot (Modul 7/8): verifikasi user di sini, lalu
// alirkan (pipe) SSE dari Express langsung ke browser tanpa buffering.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { contentId } = await params;
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
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

  // RLS: kalau bab bukan milik user, hasil select kosong
  const { data: owned } = await supabase
    .from("contents")
    .select("id")
    .eq("id", contentId)
    .maybeSingle();
  if (!owned) {
    return NextResponse.json({ error: "Bab tidak ditemukan." }, { status: 404 });
  }

  try {
    const res = await apiFetch(`/api/chat/${contentId}/message`, {
      method: "POST",
      body: JSON.stringify({ userId: user.id, message }),
    });

    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: expressErrorMessage(err) }, { status: 502 });
  }
}
