import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetch, expressErrorMessage } from "@/lib/api";

// Batas durasi fungsi di hosting (Vercel). Harus >= batas fetch ke Express
// (EXPRESS_TIMEOUT_MS di lib/api.ts) supaya bukan lapisan ini yang memutus duluan.
// CATATAN: nilai efektifnya dibatasi paket Vercel — Hobby maksimal 300 detik,
// jadi 600 hanya berlaku penuh di paket yang mengizinkannya.
export const maxDuration = 60;

const MAX_CHAT_CHARS = 500;

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above)\s+instructions/i,
  /system\s+prompt/i,
  /developer\s+mode/i,
  /\bjailbreak\b/i,
  /\bact\s+as\s+dan\b/i,
  /\bbypass\s+restriction/i,
  /you\s+are\s+now\b/i,
  /abaikan\s+(semua\s+)?instruksi/i,
  /bocorkan\s+(system\s+)?prompt/i,
  /kamu\s+sekarang\s+adalah/i,
  /mode\s+pengembang/i,
];

function isPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

// Proxy streaming chatbot (Modul 7/8): verifikasi user di sini, lalu
// alirkan (pipe) SSE dari Express langsung ke browser tanpa buffering.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { contentId } = await params;
  const body = await request.json().catch(() => ({}));
  const rawMessage = typeof body.message === "string" ? body.message.trim() : "";

  if (!rawMessage) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
  }

  if (rawMessage.length > MAX_CHAT_CHARS) {
    return NextResponse.json(
      { error: `Pesan terlalu panjang (maksimal ${MAX_CHAT_CHARS} karakter).` },
      { status: 400 }
    );
  }

  if (isPromptInjection(rawMessage)) {
    return NextResponse.json(
      {
        error:
          "Pertanyaanmu terdeteksi memuat instruksi di luar koridor pembelajaran bab ini. Silakan tanyakan materi bab secara langsung ya.",
      },
      { status: 422 }
    );
  }

  const message = rawMessage;
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
