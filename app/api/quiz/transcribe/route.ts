import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetchForm, expressErrorMessage } from "@/lib/api";
import { transcribeAudioWithGroq } from "@/lib/groqWhisper";

// Batas durasi fungsi di hosting (Vercel).
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // Fitur R — 10MB

// Fitur R & Track 11A-GW — Direct Groq Whisper Ingestion untuk jawaban esai-suara.
// Jika GROQ_API_KEY terpasang di Next.js, transkripsi diproses langsung (memotong latensi ke Express).
// Jika belum terkonfigurasi atau gagal, fallback otomatis ke Express service.
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

  // Task 15D-QS (F20): Tegakkan validasi entitlement voicePractice sebelum memproses audio
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_code, status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  const belumLewat =
    !sub?.current_period_end || new Date(sub.current_period_end).getTime() > Date.now();
  const isPaid = (sub?.status === "active" || sub?.status === "canceled") && belumLewat && sub.plan_code !== "free";
  const planCode = isPaid ? sub.plan_code : "free";

  const { getUserLimits } = await import("@/lib/plans");
  const limits = await getUserLimits(planCode);

  if (!limits.voicePractice) {
    return NextResponse.json(
      {
        error: "Fitur transkripsi suara membutuhkan paket Pro. Silakan upgrade paket Anda.",
        code: "FEATURE_LOCKED",
      },
      { status: 403 }
    );
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

  // 1. Jalur Cepat (Direct Groq Whisper di Next.js Server)
  if (process.env.GROQ_API_KEY) {
    try {
      const buffer = await audio.arrayBuffer();
      const text = await transcribeAudioWithGroq(buffer, {
        filename: audio.name || "rekaman.webm",
        language: "id",
      });
      return NextResponse.json({ text, direct: true });
    } catch (groqErr: any) {
      console.warn(
        `[DirectGroqWhisper:Quiz] Transkripsi langsung gagal (${groqErr?.message || groqErr}). Mengalihkan ke Express fallback...`
      );
    }
  }

  // 2. Jalur Cadangan (Express Fallback)
  const outgoing = new FormData();
  outgoing.append("audio", audio, audio.name || "rekaman.webm");
  outgoing.append("userId", user.id);

  try {
    const res = await apiFetchForm("/api/quiz/transcribe", outgoing);
    const data = await res.json().catch(() => ({ error: "Respons tidak valid dari API service." }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: expressErrorMessage(err) }, { status: 502 });
  }
}
