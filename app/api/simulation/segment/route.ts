import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetchSimulationForm, expressErrorMessage } from "@/lib/api";
import { transcribeAudioWithGroq } from "@/lib/groqWhisper";

const MAX_BYTES = 10 * 1024 * 1024;

// Fitur BB & Track 11A-GW — kirim segmen slide/pertanyaan (audio opsional).
// Menggunakan Direct Groq Whisper Ingestion di Next.js Server untuk memotong latensi double-hop audio.
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
  if (!incoming) {
    return NextResponse.json({ error: "Form data tidak valid." }, { status: 400 });
  }

  const audio = incoming.get("audio");
  if (audio instanceof File && audio.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Rekaman slide ini terlalu besar (maksimal 10MB)." },
      { status: 413 }
    );
  }

  const sessionId = String(incoming.get("sessionId") ?? "");
  const indexStr = String(incoming.get("index") ?? "");
  const index = Number(indexStr);

  if (!sessionId || !Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "sessionId dan index tidak valid." }, { status: 400 });
  }

  // Pre-authorization & State Guard (Task 15F-SS / F45, F67, F70):
  // Verifikasi kepemilikan sesi & status SEBELUM memicu transkripsi Groq berbayar
  const { data: session } = await supabase
    .from("simulation_sessions")
    .select("id, user_id, status, settings")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Sesi simulasi tidak ditemukan atau akses ditolak." }, { status: 404 });
  }

  if (session.status === "done" || session.status === "abandoned") {
    return NextResponse.json(
      { error: "Sesi simulasi sudah ditutup. Tidak dapat menerima segmen baru." },
      { status: 409 }
    );
  }

  const sessionLanguage = session.settings?.language === "en" ? "en" : "id";

  // 1. Jalur Cepat (Direct Groq Whisper Ingestion di Next.js Server)
  let directTranscript: string | null = null;
  if (process.env.GROQ_API_KEY && audio instanceof File && audio.size > 0) {
    try {
      const buffer = await audio.arrayBuffer();
      directTranscript = await transcribeAudioWithGroq(buffer, {
        filename: audio.name || "segmen.webm",
        language: sessionLanguage,
      });
    } catch (groqErr: any) {
      console.warn(
        `[DirectGroqWhisper:Segment] Transkripsi langsung gagal (${groqErr?.message || groqErr}). Mengalihkan ke Express fallback...`
      );
    }
  }

  const outgoing = new FormData();
  outgoing.append("userId", user.id);
  outgoing.append("sessionId", sessionId);
  outgoing.append("index", indexStr);
  outgoing.append("durationMs", String(incoming.get("durationMs") ?? "0"));
  // F53: Jika Direct STT sukses menghasilkan transkrip valid, kirim teks saja tanpa meneruskan ulang file audio
  // Jika direct kosong/gagal, teruskan file audio agar fallback Express dapat memprosesnya
  if (typeof directTranscript === "string" && directTranscript.trim().length > 0) {
    outgoing.append("transcript", directTranscript);
  } else if (audio instanceof File && audio.size > 0) {
    outgoing.append("audio", audio, "segmen.webm");
  }

  const visualMetrics = incoming.get("visualMetrics");
  if (typeof visualMetrics === "string" && visualMetrics) {
    outgoing.append("visualMetrics", visualMetrics);
  }

  const slideImage = incoming.get("slideImage");
  if (typeof slideImage === "string" && slideImage) {
    outgoing.append("slideImage", slideImage);
  }

  const cadenceMetrics = incoming.get("cadenceMetrics");
  if (typeof cadenceMetrics === "string" && cadenceMetrics) {
    outgoing.append("cadenceMetrics", cadenceMetrics);
  }

  try {
    const res = await apiFetchSimulationForm("/api/simulation/segment", outgoing);
    const data = await res.json().catch(() => ({ error: "Respons tidak valid dari API service." }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: expressErrorMessage(err, "npm run dev:simulation") }, { status: 502 });
  }
}
