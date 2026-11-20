import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiFetchSimulation, expressErrorMessage } from "@/lib/api";
import { scoreDeterministicSession, type SpeechSegmentData } from "@/lib/deterministicScorer";

// Batas durasi fungsi di hosting (Vercel).
export const maxDuration = 60;

// Fitur BD & Track 11C-DS — picu penilaian sesi (dipanggil otomatis setelah selesai, dan oleh
// tombol "Nilai Ulang" di halaman hasil).
// Mendukung Decoupled 2-Tier Scorer:
// 1. Jika sesi adalah Mode Free / Template: gunakan Deterministic Zero-Token Scorer langsung (< 50ms, 0 Token).
// 2. Jika sesi adalah Custom / Berbayar: panggil Express untuk evaluasi AI kualitatif dengan fallback aman.
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
  const sessionId = body?.sessionId;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId wajib disertakan." }, { status: 400 });
  }

  // 1. Cek detail sesi dari Supabase
  const { data: session, error: sessionErr } = await supabase
    .from("simulation_sessions")
    .select("id, user_id, type, status, context, settings")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Sesi tidak ditemukan atau akses ditolak." }, { status: 404 });
  }

  // F47: Validasi status sesi
  if (session.status === "abandoned") {
    return NextResponse.json(
      { error: "Sesi telah dibatalkan dan tidak dapat dinilai." },
      { status: 400 }
    );
  }

  let adminDb = null;
  try {
    adminDb = getSupabaseAdmin();
  } catch {
    adminDb = supabase;
  }

  const isTemplate = Boolean(session.context?.templateId);
  const isFree = Boolean(session.context?.isFree || isTemplate);

  // 2. Jalur Cepat Zero-Token (Mode Free / Template Siap Pakai)
  if (isTemplate || isFree) {
    const { data: segments } = await supabase
      .from("simulation_segments")
      .select("index, prompt_text, transcript, speech_metrics, visual_metrics")
      .eq("session_id", sessionId)
      .order("index");

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: "Sesi ini belum memiliki segmen jawaban untuk dinilai." },
        { status: 422 }
      );
    }

    const { scores, feedback } = scoreDeterministicSession(segments as SpeechSegmentData[], {
      templateId: session.context?.templateId,
      role: session.context?.role,
      title: session.context?.title,
      isInterview: session.type === "interview" || session.type === "wawancara",
      questions: session.context?.questions,
    });

    // F46: Simpan ke database menggunakan service admin dan periksa error persistensi
    const { error: reportErr } = await adminDb
      .from("simulation_reports")
      .upsert({ session_id: sessionId, scores, feedback }, { onConflict: "session_id" });

    if (reportErr) {
      console.error("[score] Gagal menyimpan simulation_reports (zero-token):", reportErr);
      return NextResponse.json(
        { error: "Gagal menyimpan laporan penilaian ke database. Silakan coba lagi." },
        { status: 500 }
      );
    }

    const { error: sessionUpdateErr } = await adminDb
      .from("simulation_sessions")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (sessionUpdateErr) {
      console.warn("[score] Gagal memperbarui status simulation_sessions:", sessionUpdateErr);
    }

    return NextResponse.json({
      ok: true,
      scores,
      feedback,
      mode: "zero-token",
      latency: "< 50ms",
    });
  }

  // 3. Jalur AI Kualitatif (Sesi Kustom / Berbayar)
  try {
    const res = await apiFetchSimulation("/api/simulation/score", {
      method: "POST",
      body: JSON.stringify({ userId: user.id, sessionId }),
    });
    const data = await res.json().catch(() => ({ error: "Respons tidak valid dari API service." }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    // Fallback Aman: Jika Express gagal/timeout, hitung skor deterministik
    const { data: fallbackSegs } = await supabase
      .from("simulation_segments")
      .select("index, prompt_text, transcript, speech_metrics, visual_metrics")
      .eq("session_id", sessionId)
      .order("index");

    if (fallbackSegs && fallbackSegs.length > 0) {
      const { scores, feedback } = scoreDeterministicSession(fallbackSegs as SpeechSegmentData[], {
        role: session.context?.role,
        title: session.context?.title,
        isInterview: session.type === "interview" || session.type === "wawancara",
      });

      const { error: reportErr } = await adminDb
        .from("simulation_reports")
        .upsert({ session_id: sessionId, scores, feedback }, { onConflict: "session_id" });

      if (reportErr) {
        console.error("[score] Gagal menyimpan simulation_reports (fallback):", reportErr);
        return NextResponse.json(
          { error: "Gagal menyimpan laporan penilaian fallback ke database." },
          { status: 500 }
        );
      }

      await adminDb
        .from("simulation_sessions")
        .update({ status: "done", finished_at: new Date().toISOString() })
        .eq("id", sessionId);

      return NextResponse.json({
        ok: true,
        scores,
        feedback,
        mode: "fallback-deterministic",
      });
    }

    return NextResponse.json({ error: expressErrorMessage(err, "npm run dev:simulation") }, { status: 502 });
  }
}
