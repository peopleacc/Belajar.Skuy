/**
 * Mesin Penilaian Deterministik Zero-Token (Deterministic Scorer)
 * Menilai rekaman audio & transkrip simulasi secara 100% matematis & berbasis rubrik kata kunci.
 * Biaya Prompt LLM: Rp 0 (Bebas Biaya Token API).
 * Waktu Eksekusi: < 50 milidetik (Instan).
 *
 * Kepatuhan: Aturan F (Zero Emoji), Pure Light Mode, ISO-25010 Reliability.
 */

import { getTemplateById } from "@/lib/interviewTemplates";

export interface SpeechSegmentData {
  index: number;
  prompt_text?: string | null;
  transcript?: string | null;
  speech_metrics?: {
    durationMs?: number | null;
    wpm?: number | null;
    wps?: number | null;
    fillerCount?: number | null;
    cadence?: {
      totalWords?: number | null;
      wps?: number | null;
      wpm?: number | null;
    } | null;
  } | null;
  visual_metrics?: {
    eyeScore?: number | null;
    handScore?: number | null;
    postureScore?: number | null;
    eyeContactRatio?: number | null;
    framesSampled?: number | null;
  } | null;
}

const STOPWORDS_ID = new Set([
  "yang", "di", "ke", "dari", "ini", "itu", "dan", "atau", "untuk", "dengan",
  "pada", "adalah", "sebagai", "saya", "kami", "kita", "bisa", "akan", "juga",
  "karena", "agar", "supaya", "dalam", "oleh", "saat", "ketika", "sudah", "telah",
  "bila", "jika", "maka", "tentang", "secara", "lebih", "sangat", "ada", "tidak",
]);

const FILLER_REGEX = /\b(e+m*|he+m+|hmm+|anu|apa ya|gitu|kayak|eh)\b/gi;

/**
 * 1. Kalkulasi Kecepatan Bicara (WPM & WPS)
 */
export function calculateSpeedScore(totalWords: number, durationSec: number) {
  const safeSec = Math.max(1, durationSec);
  if (totalWords === 0) {
    return { wps: 0, wpm: 0, score: 0, category: "Tidak Ada Ucapan Terdeteksi", totalWords: 0, durationSec: Math.round(safeSec) };
  }
  const wps = Math.round((totalWords / safeSec) * 10) / 10;
  const wpm = Math.round(wps * 60);

  let score = 75;
  let category = "Normal (Ideal)";

  if (wpm >= 110 && wpm <= 150) {
    score = 90;
    category = "Normal (Ideal)";
  } else if (wpm > 150 && wpm <= 175) {
    score = 75;
    category = "Agak Kecepatan";
  } else if (wpm >= 85 && wpm < 110) {
    score = 68;
    category = "Agak Lambat";
  } else if (wpm > 175) {
    score = 55;
    category = "Terlalu Cepat";
  } else {
    score = 50;
    category = "Terlalu Lambat";
  }

  return { wps, wpm, score, category, totalWords, durationSec: Math.round(safeSec) };
}

/**
 * 2. Kalkulasi Kata Pengisi (Filler Words)
 */
export function calculateFillerScore(transcript: string, durationSec: number) {
  const safeSec = Math.max(1, durationSec);
  if (!transcript || transcript.trim().length === 0) {
    return { fillerCount: 0, fillerPerMin: 0, score: 0, category: "Tidak Ada Ucapan Terdeteksi" };
  }
  const clean = transcript || "";
  const matches = clean.match(FILLER_REGEX) || [];
  const fillerCount = matches.length;
  const fillerPerMin = Math.round(((fillerCount / safeSec) * 60) * 10) / 10;

  // Skor: 100 dikurangi 8 poin per filler/menit
  const score = Math.max(40, Math.min(100, Math.round(100 - fillerPerMin * 8)));

  let category = "Sangat Bersih";
  if (fillerPerMin <= 2) category = "Sangat Bersih (Minimal Filler)";
  else if (fillerPerMin <= 5) category = "Cukup Terkendali";
  else if (fillerPerMin <= 9) category = "Perlu Dikurangi";
  else category = "Banyak Kata Pengisi";

  return { fillerCount, fillerPerMin, score, category };
}

/**
 * 3. Kalkulasi Kesesuaian Kata Kunci (Keyword Relevance Rubric)
 */
export function calculateKeywordRelevance(
  transcript: string,
  expectedKeywords: string[] = []
) {
  if (!transcript || transcript.trim().length === 0) {
    return {
      matchScore: 0,
      matchedKeywords: [],
      missingKeywords: [...expectedKeywords],
      ratio: 0,
    };
  }

  const clean = (transcript || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const transcriptWords = clean.split(/\s+/).filter(Boolean);

  if (expectedKeywords.length === 0) {
    // Fallback jika tidak ada rubrik spesifik: dinilai dari kecukupan elaborasi kata
    const wordCount = transcriptWords.length;
    let score = 70;
    if (wordCount >= 40) score = 88;
    else if (wordCount >= 25) score = 78;
    else if (wordCount >= 12) score = 65;
    else score = 50;

    return {
      matchScore: score,
      matchedKeywords: [],
      missingKeywords: [],
      ratio: 1.0,
    };
  }

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of expectedKeywords) {
    const kwNorm = kw.toLowerCase().trim();
    if (clean.includes(kwNorm)) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  const ratio = matchedKeywords.length / expectedKeywords.length;
  let baseScore = Math.round(ratio * 80);

  // Bonus elaborasi panjang ucapan (panjang kalimat mencukupi)
  if (transcriptWords.length >= 35) {
    baseScore += 20;
  } else if (transcriptWords.length >= 20) {
    baseScore += 12;
  } else if (transcriptWords.length >= 10) {
    baseScore += 6;
  }

  const matchScore = Math.max(30, Math.min(100, baseScore));

  return {
    matchScore,
    matchedKeywords,
    missingKeywords,
    ratio: Math.round(ratio * 100) / 100,
  };
}

/**
 * 4. Kalkulasi Kesesuaian Teks Slide (Untuk Simulasi Presentasi)
 */
export function calculateSlideRelevance(transcript: string, slideText: string) {
  if (!transcript || transcript.trim().length === 0) {
    return {
      matchScore: 0,
      matchedKeywords: [],
      missingKeywords: [],
      ratio: 0,
    };
  }

  const cleanSlide = (slideText || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const slideWords = cleanSlide
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS_ID.has(w));

  const uniqueSlideKeywords = Array.from(new Set(slideWords)).slice(0, 15);
  if (uniqueSlideKeywords.length === 0) {
    return {
      matchScore: 0,
      matchedKeywords: [],
      missingKeywords: [],
      ratio: 0,
    };
  }
  return calculateKeywordRelevance(transcript, uniqueSlideKeywords);
}

/**
 * 5. Kalkulasi Kosakata & Repetisi Monoton
 */
export function calculateVocabMetrics(segments: SpeechSegmentData[]) {
  let totalWordsAnalyzed = 0;
  for (const s of segments) {
    const words = (s.transcript ?? "").split(/\s+/).filter(Boolean);
    totalWordsAnalyzed += words.length;
  }
  if (totalWordsAnalyzed === 0) {
    return {
      vocabScore: 0,
      monotonCount: 0,
      monotonWords: [],
      category: "Tidak Ada Ucapan Terdeteksi",
    };
  }

  let monotonCount = 0;
  const wordCounts: Record<string, number> = {};

  for (const s of segments) {
    const words = (s.transcript ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS_ID.has(w));

    for (const w of words) {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    }
  }

  const monotonWords: string[] = [];
  for (const [w, count] of Object.entries(wordCounts)) {
    if (count >= 4) {
      monotonCount += count - 3;
      monotonWords.push(w);
    }
  }

  const rawVocabScore = 100 - monotonCount * 5;
  const vocabScore = Math.max(40, Math.min(100, rawVocabScore));

  let category = "Cukup Baik Pemilihan Katanya";
  if (vocabScore >= 80) category = "Variatif & Efektif";
  else if (vocabScore >= 65) category = "Cukup Baik Pemilihan Katanya";
  else category = "Cenderung Repetitif (Butuh Variasi Kata)";

  return {
    vocabScore,
    monotonCount,
    monotonWords: monotonWords.slice(0, 5),
    category,
  };
}

/**
 * 6. Mesin Penilai Lengkap Zero-Token untuk Sesi Simulasi
 */
export function scoreDeterministicSession(
  segments: SpeechSegmentData[],
  sessionContext?: {
    templateId?: string | null;
    role?: string | null;
    title?: string | null;
    isInterview?: boolean;
    questions?: string[] | null;
  }
) {
  const totalMs = segments.reduce(
    (a, s) => a + (s.speech_metrics?.durationMs ?? 0),
    0
  );
  const totalSec = Math.max(1, totalMs / 1000);

  // 1. Kecepatan Bicara
  let totalWords = 0;
  for (const s of segments) {
    if (s.speech_metrics?.cadence?.totalWords) {
      totalWords += s.speech_metrics.cadence.totalWords;
    } else {
      const words = (s.transcript ?? "").split(/\s+/).filter(Boolean);
      totalWords += words.length;
    }
  }
  const speed = calculateSpeedScore(totalWords, totalSec);

  // 2. Kata Pengisi
  const combinedTranscript = segments
    .map((s) => s.transcript ?? "")
    .join(" ");
  const filler = calculateFillerScore(combinedTranscript, totalSec);

  // 3. Relevansi per Soal / Slide (F51: dukung presentasi & index lookup stabil)
  const template = sessionContext?.templateId
    ? getTemplateById(sessionContext.templateId)
    : null;
  const isPresentation = sessionContext?.isInterview === false;

  const perSlideFeedback = segments.map((s, idx) => {
    const tplQuestion = template?.questions?.[s.index] ?? template?.questions?.[idx];
    const expectedKws = tplQuestion?.expectedKeywords ?? [];
    const promptText = s.prompt_text || "";

    const relevance = isPresentation && promptText
      ? calculateSlideRelevance(s.transcript || "", promptText)
      : calculateKeywordRelevance(s.transcript || "", expectedKws);

    const good: string[] = [];
    const missing: string[] = [];

    if (relevance.matchedKeywords.length > 0) {
      good.push(
        `Menyampaikan poin kunci: ${relevance.matchedKeywords.join(", ")}`
      );
    }
    if (relevance.missingKeywords.length > 0) {
      missing.push(
        `Belum mengelaborasi aspek: ${relevance.missingKeywords.join(", ")}`
      );
    }
    if ((s.transcript || "").split(/\s+/).length >= 25) {
      good.push("Durasi dan panjang jawaban memadai.");
    } else {
      missing.push("Jawaban masih terlalu singkat, elaborasi lebih dalam.");
    }

    const comment =
      relevance.matchScore >= 80
        ? "Jawaban sangat solid dan mencakup kata kunci kompetensi yang diharapkan."
        : relevance.matchScore >= 65
        ? "Jawaban cukup terarah, tambahkan rincian aksi konkret untuk melengkapi poin."
        : "Fokuskan jawaban pada kata kunci pertanyaan dan jelaskan tahapan solusi dengan lebih terstruktur.";

    return {
      index: s.index,
      match_score: relevance.matchScore,
      why_explanation: `Tingkat kesesuaian jawaban ${relevance.matchScore}% berdasarkan penyebutan ${relevance.matchedKeywords.length} dari ${expectedKws.length || "beberapa"} poin kompetensi utama.`,
      good,
      missing,
      comment,
      model_answer: tplQuestion?.tips
        ? `Panduan Jawaban: ${tplQuestion.tips}`
        : "Fokus pada struktur SITUATION - TASK - ACTION - RESULT secara runut.",
      model_answer_highlights: relevance.matchedKeywords,
      target_duration_sec: template?.targetTimePerQuestionSec || 45,
      vocab_analysis: {
        monoton_words: [],
        kasar_words: [],
        tidak_baku_words: [],
        vocab_comment: "Tata bahasa komunikatif.",
      },
    };
  });

  let avgRelevance =
    perSlideFeedback.length > 0
      ? Math.round(
          perSlideFeedback.reduce((a, b) => a + b.match_score, 0) /
            perSlideFeedback.length
        )
      : 75;

  let relevanceCategory = "Cukup Jelas";
  if (totalWords === 0) {
    avgRelevance = 0;
    relevanceCategory = "Tidak Ada Ucapan Terdeteksi";
  } else if (avgRelevance >= 88) {
    relevanceCategory = "Sangat Jelas & Terstruktur";
  } else if (avgRelevance >= 72) {
    relevanceCategory = "Cukup Jelas";
  } else {
    relevanceCategory = "Perlu Lebih Terarah";
  }

  // 4. Kosakata
  const vocab = calculateVocabMetrics(segments);

  // 5. Visual MediaPipe (Tangan & Mata)
  const handScores = segments
    .map((s) => s.visual_metrics?.handScore)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const avgHand =
    handScores.length > 0
      ? Math.round(handScores.reduce((a, b) => a + b, 0) / handScores.length)
      : null;

  const eyeScores = segments
    .map((s) => s.visual_metrics?.eyeScore)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const avgEye =
    eyeScores.length > 0
      ? Math.round(eyeScores.reduce((a, b) => a + b, 0) / eyeScores.length)
      : null;

  const hasVisual = avgHand != null && avgEye != null;

  // 6. Komposit Rata-Rata Terbobot (5 Indikator, F50: skor 0 saat tanpa ucapan)
  let overall = 0;
  if (totalWords === 0) {
    overall = hasVisual
      ? Math.round(0.10 * (avgHand ?? 0) + 0.10 * (avgEye ?? 0))
      : 0;
  } else if (hasVisual) {
    overall = Math.round(
      0.30 * speed.score +
      0.30 * avgRelevance +
      0.20 * vocab.vocabScore +
      0.10 * avgHand! +
      0.10 * avgEye!
    );
  } else {
    overall = Math.round(
      0.375 * speed.score +
      0.375 * avgRelevance +
      0.25 * vocab.vocabScore
    );
  }

  // Rakit Feedback Lengkap
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (totalWords === 0) {
    strengths.push("Kemauan berlatih dan menyelesaikan seluruh sesi secara tuntas.");
    improvements.push("Tidak ada ucapan terdeteksi. Aktifkan mikrofon dan berbicaralah selama sesi untuk mendapatkan analisis wicara.");
  } else {
    if (speed.score >= 80) strengths.push(`Tempo wicara teratur (${speed.wpm} WPM) sehingga mudah dipahami audiens.`);
    else improvements.push(`Sesuaikan tempo wicara agar mendekati 120-140 WPM (saat ini ${speed.wpm} WPM).`);

    if (filler.score >= 80) strengths.push("Artikulasi bersih dengan minim kata pengisi (filler words).");
    else improvements.push(`Kurangi jeda gumaman/filler words (terdeteksi ${filler.fillerCount} kali).`);

    if (avgRelevance >= 75) strengths.push("Poin-poin kompetensi dan kata kunci inti berhasil disampaikan secara lugas.");
    else improvements.push("Tingkatkan ketajaman argumen dengan menyertakan kata kunci teknis yang relevan.");
  }

  if (hasVisual && avgEye! >= 75) strengths.push("Kontak mata konsisten menghadap kamera dengan percaya diri.");
  if (hasVisual && avgHand! >= 75) strengths.push("Gestur tangan terbuka dan mempertegas poin pembicaraan.");

  if (strengths.length === 0) strengths.push("Kemauan berlatih dan menyelesaikan seluruh sesi secara tuntas.");
  if (improvements.length === 0) improvements.push("Pertahankan konsistensi intonasi dan artikulasi vokal.");

  const scores = {
    overall,
    speed_score: speed.score,
    relevance_score: avgRelevance,
    vocab_score: vocab.vocabScore,
    hand_score: avgHand,
    eye_score: avgEye,
    speed_metrics: {
      wps: speed.wps,
      wpm: speed.wpm,
      category: speed.category,
      total_words: speed.totalWords,
      duration_sec: speed.durationSec,
    },
    relevance_metrics: {
      category: relevanceCategory,
      match_score: avgRelevance,
    },
    vocab_metrics: {
      monoton_count: vocab.monotonCount,
      kasar_count: 0,
      tidak_baku_count: 0,
      category: vocab.category,
    },
    hand_metrics: {
      score: avgHand,
      category: avgHand && avgHand >= 75 ? "Dinamis & Terbuka" : "Pasif / Netral",
    },
    eye_metrics: {
      score: avgEye,
      category: avgEye && avgEye >= 75 ? "Fokus Menghadap Kamera" : "Netral",
    },
    content: avgRelevance,
    delivery: Math.round(totalWords === 0 ? (hasVisual ? ((avgHand ?? 0) + (avgEye ?? 0)) / 2 : 0) : ((speed.score + (avgEye ?? 75)) / 2)),
    is_zero_token: true,
  };

  const feedback = {
    summary: `Sesi latihan diselesaikan dengan total ${segments.length} respons dalam ${Math.round(totalSec)} detik. Skor keseluruhan mencapai ${overall}/100 dengan performa penyampaian ${speed.category}.`,
    qualitative_note: totalWords === 0
      ? "Tidak ada ucapan atau transkrip audio yang terdeteksi dalam sesi ini. Silakan periksa izin mikrofon perangkat Anda untuk mendapatkan evaluasi konten dan tempo bicara."
      : `Secara keseluruhan, artikulasi ucapan berada pada tempo ${speed.wpm} kata/menit dengan tingkat relevansi kompetensi ${avgRelevance}%. Evaluasi deterministik menunjukkan penguasaan materi yang ${relevanceCategory.toLowerCase()}.`,
    per_slide: perSlideFeedback,
    vocab_summary: {
      monoton_words: vocab.monotonWords,
      kasar_words: [],
      tidak_baku_words: [],
      overall_vocab_comment: vocab.category,
    },
    strengths,
    improvements,
  };

  return { scores, feedback };
}

