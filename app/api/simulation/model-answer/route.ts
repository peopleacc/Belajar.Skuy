import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

export const maxDuration = 30;

// Task 11C-DS: On-Demand Model Answer Generator
// Membangkitkan contoh jawaban ideal hanya saat pengguna mengklik kartu pertanyaan spesifik di halaman laporan.
// Memangkas waktu tunggu penilaian batch awal dari 35 detik menjadi < 3 detik.
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
  const { sessionId, questionIndex } = body;
  if (!sessionId || questionIndex == null || !Number.isInteger(Number(questionIndex))) {
    return NextResponse.json(
      { error: "sessionId & questionIndex wajib disertakan." },
      { status: 400 }
    );
  }

  const qIdx = Number(questionIndex);

  // 1. Ambil detail sesi & laporan
  const { data: session } = await supabase
    .from("simulation_sessions")
    .select("id, user_id, type, status, context, settings")
    .eq("id", sessionId)
    .single();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Sesi tidak ditemukan atau akses ditolak." }, { status: 404 });
  }

  if (session.status === "abandoned") {
    return NextResponse.json({ error: "Sesi telah dibatalkan." }, { status: 400 });
  }

  const { data: report } = await supabase
    .from("simulation_reports")
    .select("scores, feedback")
    .eq("session_id", sessionId)
    .single();

  // 2. Ambil teks pertanyaan dari segmen (F55: validasi membership segmen sebelum memicu AI)
  const { data: segment } = await supabase
    .from("simulation_segments")
    .select("prompt_text, transcript")
    .eq("session_id", sessionId)
    .eq("index", qIdx)
    .maybeSingle();

  if (!segment) {
    return NextResponse.json({ error: "Segmen tidak ditemukan untuk index yang diminta." }, { status: 404 });
  }

  const questionText = segment.prompt_text || `Item ke-${qIdx + 1}`;

  // EV03: Lookup berdasarkan index item, bukan posisi array
  const existingItem = report?.feedback?.per_slide?.find((p: any) => p.index === qIdx);
  const existingAnswer = existingItem?.model_answer;

  // Jika jawaban ideal spesifik sudah pernah di-generate sebelumnya: kembalikan langsung dari cache DB!
  if (
    existingAnswer &&
    typeof existingAnswer === "string" &&
    existingAnswer.length > 40 &&
    !existingAnswer.startsWith("Panduan Jawaban:") &&
    !existingAnswer.startsWith("Fokus pada struktur")
  ) {
    const highlights = existingItem?.model_answer_highlights || ["Struktur Terarah", "Berorientasi Solusi"];
    return NextResponse.json({
      modelAnswer: existingAnswer,
      model_answer: existingAnswer, // EV03: Samakan DTO konsisten
      highlights,
      model_answer_highlights: highlights,
      cached: true,
    });
  }

  // 3. Bangkitkan on-demand dengan Groq AI (F55: dukung presentasi & bahasa sesi)
  const apiKey = process.env.GROQ_API_KEY;
  let generatedAnswer = "";
  const role = session.context?.role || session.context?.title || "profesional";
  const isPresentation = session.type === "presentation";
  const isEnglish = session.settings?.language === "en";

  let systemPrompt = "";
  let userPrompt = "";

  if (isPresentation) {
    if (isEnglish) {
      systemPrompt =
        "You are an expert presentation and public speaking coach. Provide a concise 1-paragraph model explanation (60-90 words) demonstrating how a speaker should eloquently present and elaborate on the slide content.";
      userPrompt = `Presentation slide topic (${role}):\n"${questionText}"\nProvide a 1-paragraph model spoken presentation that directly presents this slide. Respond ONLY with the spoken words without any preamble.`;
    } else {
      systemPrompt =
        "Kamu adalah pelatih presentasi dan public speaking profesional. Berikan 1 paragraf contoh narasi presentasi ideal yang ringkas (60-90 kata), padat, meyakinkan, dan mengelaborasi materi slide secara efektif dalam Bahasa Indonesia.";
      userPrompt = `Materi slide presentasi (${role}):\n"${questionText}"\nBerikan 1 paragraf contoh narasi lisan terbaik yang langsung dapat disampaikan presenter. Balas HANYA teks narasi tersebut tanpa pengantar apapun.`;
    }
  } else {
    if (isEnglish) {
      systemPrompt =
        "You are a professional interview coach. Provide a concise 1-paragraph model interview answer (60-90 words) using a structured approach (STAR: Situation, Task, Action, Result) in professional English.";
      userPrompt = `Interview question for ${role}:\n"${questionText}"\nProvide 1 paragraph of the best verbal answer the candidate can say. Respond ONLY with the answer text without any preamble.`;
    } else {
      systemPrompt =
        "Kamu adalah pelatih wawancara profesional. Berikan 1 paragraf contoh jawaban ideal yang ringkas (60-90 kata), padat, berwibawa, dan menggunakan pendekatan terstruktur (Situation, Task, Action, Result) dalam Bahasa Indonesia.";
      userPrompt = `Pertanyaan wawancara untuk posisi ${role}:\n"${questionText}"\nBerikan 1 paragraf contoh jawaban lisan terbaik yang langsung bisa diucapkan kandidat. Balas HANYA teks jawaban tersebut tanpa pengantar apapun.`;
    }
  }

  if (apiKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
          max_tokens: 300,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        generatedAnswer = data.choices?.[0]?.message?.content?.trim() || "";
      }
    } catch (groqErr) {
      console.warn("[model-answer] Pemanggilan Groq on-demand gagal:", groqErr);
    }
  }

  if (!generatedAnswer) {
    if (isPresentation) {
      generatedAnswer = isEnglish
        ? `On this slide, our core focus is aligning strategic objectives with actionable milestones, ensuring all key stakeholders are equipped with measurable outcomes and clear delivery timelines.`
        : `Pada bagian ini, fokus utama kami adalah menyelaraskan target strategis dengan langkah eksekusi konkret, memastikan setiap indikator keberhasilan tercapai tepat waktu dengan standar mutu optimal.`;
    } else {
      generatedAnswer = isEnglish
        ? `As a ${role}, my primary approach in this situation is to evaluate the core challenge objectively, collaborate with the team on a measurable plan, and execute within our quality and timeline standards.`
        : `Sebagai ${role}, langkah utama saya ketika menghadapi kondisi ini adalah menganalisis akar masalah secara objektif, menyusun rencana aksi terukur bersama tim, dan memastikan eksekusi berjalan sesuai standar kualitas serta tenggat waktu yang disepakati.`;
    }
  }

  const defaultHighlights = ["Struktur Terarah", "Berorientasi Solusi", "Profesional"];

  // Simpan hasil ke Supabase agar pemanggilan berikutnya instan
  if (report?.feedback?.per_slide && Array.isArray(report.feedback.per_slide)) {
    const updatedPerSlide = [...report.feedback.per_slide];
    const targetIdx = updatedPerSlide.findIndex((p: any) => p.index === qIdx);
    if (targetIdx !== -1) {
      updatedPerSlide[targetIdx] = {
        ...updatedPerSlide[targetIdx],
        model_answer: generatedAnswer,
        model_answer_highlights: defaultHighlights,
      };
      await supabase
        .from("simulation_reports")
        .update({
          feedback: {
            ...report.feedback,
            per_slide: updatedPerSlide,
          },
        })
        .eq("session_id", sessionId);
    }
  }

  // EV03: Samakan DTO response di kedua sisi
  return NextResponse.json({
    modelAnswer: generatedAnswer,
    model_answer: generatedAnswer,
    highlights: defaultHighlights,
    model_answer_highlights: defaultHighlights,
  });
}
