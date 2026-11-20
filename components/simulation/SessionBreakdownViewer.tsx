"use client";

import { useState, useEffect } from "react";

export type PerSlideFeedback = {
  index: number;
  match_score: number;
  why_explanation?: string | null;
  good: string[];
  missing: string[];
  comment: string;
  model_answer?: string | null;
  model_answer_highlights?: string[] | null;
  target_duration_sec?: number | null;
  vocab_analysis?: {
    monoton_words?: string[] | null;
    kasar_words?: string[] | null;
    tidak_baku_words?: string[] | null;
    vocab_comment?: string | null;
  } | null;
};

export type SegmentDetailRow = {
  index: number;
  prompt_text: string | null;
  transcript: string | null;
  slide_image_url?: string | null;
  speech_metrics: {
    wpm: number | null;
    wps?: number | null;
    fillerCount: number;
    durationMs: number;
    cadence?: {
      avgWps?: number | null;
      avgWpm?: number | null;
      totalWords?: number | null;
      speedScore?: number | null;
      category?: string | null;
    } | null;
  } | null;
  visual_metrics: {
    eyeScore?: number | null;
    handScore?: number | null;
    gazeFocusPct?: number | null;
    gazeAudiencePct?: number | null;
    gazeUnfocusedPct?: number | null;
    readingSuspicion?: boolean | null;
    handNaturalPct?: number | null;
    handStaticPct?: number | null;
    handCrossedPct?: number | null;
    handBelowHipPct?: number | null;
    eyeContactRatio?: number | null;
    postureScore?: number | null;
    gestureRate?: number | null;
    framesSampled?: number;
  } | null;
};

function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function scoreColor(v: number | null) {
  if (v == null) return "text-slate-400";
  if (v >= 80) return "text-emerald-600";
  if (v >= 65) return "text-brand-500";
  if (v >= 50) return "text-amber-500";
  return "text-rose-500";
}

function scoreBg(v: number | null) {
  if (v == null) return "bg-slate-50 border-slate-200 text-slate-500";
  if (v >= 80) return "bg-emerald-500/10 border-emerald-500/20 text-emerald-700";
  if (v >= 65) return "bg-brand-500/10 border-brand-500/20 text-brand-700";
  if (v >= 50) return "bg-amber-500/10 border-amber-500/20 text-amber-700";
  return "bg-rose-500/10 border-rose-500/20 text-rose-700";
}

export default function SessionBreakdownViewer({
  sessionId,
  segments,
  feedbacks,
  isInterview,
  totalItems: _totalItems,
}: {
  sessionId?: string;
  segments: SegmentDetailRow[];
  feedbacks: Map<number, PerSlideFeedback>;
  isInterview: boolean;
  totalItems: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [expandedAnswers, setExpandedAnswers] = useState<
    Record<number, { modelAnswer: string; highlights: string[] }>
  >({});
  const [loadingModelAnswer, setLoadingModelAnswer] = useState(false);

  // Keyboard shortcut ESC untuk menutup modal zoom
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setZoomImageUrl(null);
    }
    if (zoomImageUrl) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [zoomImageUrl]);

  // Batalkan suara pelafalan saat berganti slide/pertanyaan
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setCopied(false);
    setZoomImageUrl(null);
  }, [activeIndex]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Belum ada segmen yang tersimpan di sesi ini.
      </div>
    );
  }

  const activeSegment = segments.find((s) => s.index === activeIndex) || segments[0];
  const fb = feedbacks.get(activeSegment.index);
  const sm = activeSegment.speech_metrics;
  const vm = activeSegment.visual_metrics;

  // 1. Kecepatan Ngomong
  const segWpm = sm?.cadence?.avgWpm ?? sm?.wpm ?? 0;
  const segWps = sm?.cadence?.avgWps ?? (sm?.durationMs ? Math.round(((sm.cadence?.totalWords ?? 0) / (sm.durationMs / 1000)) * 10) / 10 : 0);
  let speedScore = sm?.cadence?.speedScore ?? 75;
  let speedLabel = "Normal (Ideal)";
  if (segWpm >= 110 && segWpm <= 150) {
    speedScore = 90;
    speedLabel = "Normal (Ideal)";
  } else if (segWpm > 150 && segWpm <= 175) {
    speedScore = 75;
    speedLabel = "Agak Kecepatan";
  } else if (segWpm >= 85 && segWpm < 110) {
    speedScore = 68;
    speedLabel = "Agak Lambat";
  } else if (segWpm > 0) {
    speedScore = 55;
    speedLabel = "Terlalu Cepat / Tersendat";
  }

  // 2. Akurasi Kesesuaian Jawaban AI
  const relevanceScore = fb ? fb.match_score : 75;
  let relevanceLabel = "Cukup Jelas";
  if (relevanceScore >= 95) relevanceLabel = "Sangat Jelas";
  else if (relevanceScore >= 90) relevanceLabel = "Sangat Lengkap (Membaca Teks)";
  else if (relevanceScore >= 70) relevanceLabel = "Cukup Jelas";
  else if (relevanceScore >= 60) relevanceLabel = "Kurang Jelas";
  else relevanceLabel = "Melantur";

  // 3. Penggunaan Kata / Diksi
  const va = fb?.vocab_analysis;
  const monotonWords = va?.monoton_words ?? [];
  const kasarWords = va?.kasar_words ?? [];
  const tidakBakuWords = va?.tidak_baku_words ?? [];
  const rawVocab = 100 - (monotonWords.length * 5) - (kasarWords.length * 20) - (tidakBakuWords.length * 2);
  const vocabScore = Math.max(40, Math.min(100, rawVocab));
  let vocabLabel = "Cukup Baik Pemilihannya";
  if (vocabScore >= 70) vocabLabel = "Cukup Baik Pemilihannya";
  else if (vocabScore >= 60) vocabLabel = "Bisa Lebih Baik Pemilihannya";
  else vocabLabel = "Butuh Pemilihan Kata yang Lebih Baik";

  // 4. Pergerakan Tangan
  const handScore = vm?.handScore ?? 75;
  let handLabel = "Dinamis & Terarah";
  if (handScore >= 85) handLabel = "Sering & Alami (Gestur Terbuka)";
  else if (handScore >= 70) handLabel = "Dinamis & Terarah";
  else if (handScore >= 60) handLabel = "Jarang / Pasif";
  else handLabel = "Kurang / Tertutup";

  // 5. Pergerakan Mata
  const eyeScore = vm?.eyeScore ?? (vm?.eyeContactRatio ? Math.round(vm.eyeContactRatio * 100) : 75);
  let eyeLabel = "Fokus & Audiens";
  if (eyeScore >= 85) eyeLabel = "Fokus & Tenang";
  else if (eyeScore >= 75) eyeLabel = "Memperhatikan Audiens";
  else if (eyeScore >= 60) eyeLabel = "Netral";
  else eyeLabel = "Mata Melompat Liar";

  const itemTitle = isInterview ? "Pertanyaan" : "Slide";

  // Contoh Jawaban yang Seharusnya (AI Exemplar)
  const defaultModelAnswer = isInterview
    ? "Saat menangani proyek ini, saya menghadapi tantangan pemenuhan target dalam tenggat waktu yang ketat. Saya berinisiatif membagi alur kerja ke dalam beberapa fase terukur dan berkolaborasi erat dengan tim. Hasilnya, target berhasil diselesaikan 2 hari lebih awal dengan tingkat akurasi mencapai 98%."
    : "Pada bagian ini, materi menekankan pentingnya integrasi proses secara terpadu. Melalui penerapan strategi yang sistematis, kita dapat meningkatkan efisiensi operasional sekaligus meminimalisasi risiko kesalahan entri secara terukur.";

  // Cek apakah jawaban telah diperluas secara on-demand (Track 11D)
  const hasExpanded = Boolean(expandedAnswers[activeSegment.index]);
  const activeExpanded = expandedAnswers[activeSegment.index];

  const modelAnswer = activeExpanded?.modelAnswer || fb?.model_answer?.trim() || defaultModelAnswer;
  const modelHighlights = activeExpanded?.highlights && activeExpanded.highlights.length > 0
    ? activeExpanded.highlights
    : fb?.model_answer_highlights && fb.model_answer_highlights.length > 0
    ? fb.model_answer_highlights
    : [
        "Membuka narasi dengan penekanan poin utama secara lugas",
        "Menyampaikan substansi dengan struktur runtut dan terukur",
        "Pilihan diksi profesional tanpa repetisi kata monoton",
      ];
  const targetDurationSec = fb?.target_duration_sec ?? 30;

  const fetchExpandedModelAnswer = async () => {
    if (loadingModelAnswer || !activeSegment) return;
    setLoadingModelAnswer(true);
    try {
      const res = await fetch("/api/simulation/model-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionIndex: activeSegment.index,
          questionText: activeSegment.prompt_text ?? "",
          userTranscript: activeSegment.transcript ?? "",
          role: isInterview ? "Kandidat Profesional" : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && (data?.model_answer || data?.modelAnswer)) {
        setExpandedAnswers((prev) => ({
          ...prev,
          [activeSegment.index]: {
            modelAnswer: data.model_answer || data.modelAnswer,
            highlights: data.model_answer_highlights || data.highlights || [],
          },
        }));
      }
    } catch (err) {
      console.error("Gagal mengambil model answer on-demand:", err);
    } finally {
      setLoadingModelAnswer(false);
    }
  };

  const handleSpeak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Tab Pemilih Sesi / Slide (Gambar 1 Pengguna) ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <span className="mr-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          Pilih {itemTitle}:
        </span>
        {segments.map((s) => {
          const isActive = s.index === activeIndex;
          const sFb = feedbacks.get(s.index);
          return (
            <button
              key={s.index}
              type="button"
              onClick={() => setActiveIndex(s.index)}
              className={`group flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                isActive
                  ? "bg-brand-500 text-white shadow-brand-500/20"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>{itemTitle} {s.index + 1}</span>
              {sFb && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                    isActive
                      ? "bg-white/20 text-white"
                      : scoreBg(sFb.match_score)
                  }`}
                >
                  {sFb.match_score}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Slide Visual Preview & Materi Teks (Update 21) ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3">
          <span className="flex items-center gap-2 text-xs font-bold text-brand-700">
            <i className={isInterview ? "bi bi-chat-left-quote-fill" : "bi bi-file-earmark-slides-fill"} />
            {isInterview ? "Pertanyaan Sesi Wawancara" : `Materi Slide #${activeSegment.index + 1}`}
          </span>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {activeSegment.slide_image_url && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                <i className="bi bi-eye-fill text-emerald-600" /> Dinilai Vision AI
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <i className="bi bi-clock-history text-slate-400" />
              Durasi: {fmtDuration(activeSegment.speech_metrics?.durationMs ?? 0)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-12 items-start">
          {/* Kolom Kiri: Gambar Slide PPT Asli (16:9) ATAU Kartu Proyektor Teks 16:9 */}
          {!isInterview && (
            <div className="md:col-span-5">
              {activeSegment.slide_image_url ? (
                <div
                  onClick={() => setZoomImageUrl(activeSegment.slide_image_url ?? null)}
                  className="group relative flex aspect-video cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition hover:shadow-md"
                >
                  <img
                    src={activeSegment.slide_image_url}
                    alt={`Slide ${activeSegment.index + 1}`}
                    className="h-full w-full object-contain transition duration-200 group-hover:scale-105"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                    <span className="flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur-sm">
                      <i className="bi bi-arrows-fullscreen" /> Klik untuk Perbesar
                    </span>
                  </div>
                </div>
              ) : (
                /* Fallback Kartu PPT 16:9 Bergaya Proyektor Modern */
                <div className="flex aspect-video flex-col justify-between rounded-xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-sm">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-700/60 pb-2">
                    <span className="font-bold tracking-wider uppercase text-brand-400 flex items-center gap-1">
                      <i className="bi bi-easel2-fill" /> Slide Presentation Deck
                    </span>
                    <span>#{activeSegment.index + 1}</span>
                  </div>
                  <p className="my-auto text-xs font-semibold leading-relaxed text-slate-200 line-clamp-4">
                    {activeSegment.prompt_text || "(Slide visual tanpa teks)"}
                  </p>
                  <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1">
                    <span>belajar.skuy</span>
                    <span>Format 16:9</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Kolom Kanan: Uraian Teks Materi & Poin Konsep */}
          <div className={!isInterview ? "space-y-2 md:col-span-7" : "space-y-2 md:col-span-12"}>
            <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <i className="bi bi-card-text text-brand-500" />
              {isInterview ? "Teks Pertanyaan Wawancara:" : "Teks Materi Terekstrak:"}
            </p>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
              <p className="text-xs font-medium leading-relaxed text-slate-800">
                {activeSegment.prompt_text || "(Tidak ada teks yang dapat diekstrak dari slide ini)"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Narasi Transkrip Sesi Ini ── */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
          <i className="bi bi-mic-fill text-brand-500" />
          Transkrip Narasi Anda pada Sesi Ini:
        </p>
        <p className="text-sm leading-relaxed text-slate-700 italic">
          {activeSegment.transcript ? `"${activeSegment.transcript}"` : "(Tidak ada transkrip terekam pada sesi ini)"}
        </p>
        {/* Indikator Kata Kunci Terdeteksi (Track 11D Keywords Matched) */}
        {fb?.good && fb.good.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-200/80 pt-2.5">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <i className="bi bi-tag-fill text-brand-500" /> Kata Kunci Terdeteksi:
            </span>
            {fb.good.map((kw, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"
              >
                <i className="bi bi-check2 text-emerald-600 font-bold" />
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── TINGKAT 2 (GAMBAR 1): 3 KARTU SUARA & ISI DI ATAS ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Kartu 1: Penggunaan Kata (20%) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>PENGGUNAAN KATA</span>
            <span className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-600">20%</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className={`text-3xl font-black ${scoreColor(vocabScore)}`}>{vocabScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-700">{vocabLabel}</p>
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <p>• Monoton: <span className="font-semibold text-slate-700">{monotonWords.length} repetisi</span></p>
            <p>• Tidak Baku: <span className="font-semibold text-slate-700">{tidakBakuWords.length} kata</span></p>
            <p>• Kata Kasar: <span className="font-semibold text-slate-700">{kasarWords.length} terdeteksi</span></p>
          </div>
        </div>

        {/* Kartu 2: Kesesuaian Jawaban AI (30%) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>KESESUAIAN JAWABAN AI</span>
            <span className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-600">30%</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className={`text-3xl font-black ${scoreColor(relevanceScore)}`}>{relevanceScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-700">{relevanceLabel}</p>
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <p>• Poin Terbahas: <span className="font-semibold text-emerald-600">{fb?.good?.length ?? 0} poin kunci</span></p>
            <p>• Poin Terlewat: <span className="font-semibold text-amber-600">{fb?.missing?.length ?? 0} poin</span></p>
            <p>• Evaluasi: <span className="font-semibold text-slate-700 line-clamp-1">{fb?.comment ?? "Sesuai materi"}</span></p>
          </div>
        </div>

        {/* Kartu 3: Kecepatan Kalimat & Kata (30%) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>KECEPATAN KALIMAT / KATA</span>
            <span className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-600">30%</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className={`text-3xl font-black ${scoreColor(speedScore)}`}>{speedScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-700">{speedLabel}</p>
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <p>• Kecepatan: <span className="font-semibold text-slate-700">{segWps || "2.1"} kata/detik</span></p>
            <p>• Cadence: <span className="font-semibold text-slate-700">{segWpm || "120"} WPM</span></p>
            <p>• Kata Pengisi: <span className="font-semibold text-slate-700">{sm?.fillerCount ?? 0} kata</span></p>
          </div>
        </div>
      </div>

      {/* ── TINGKAT 2 (GAMBAR 1): 2 KARTU KAMERA DI TENGAH ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Kartu 4: Pergerakan Mata (10%) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <i className="bi bi-eye-fill text-brand-500" />
              NILAI DAN PERGERAKAN TIAP MATA
            </span>
            <span className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-600">10%</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className={`text-3xl font-black ${scoreColor(eyeScore)}`}>{eyeScore}</span>
              <span className="ml-1 text-xs text-slate-400">/ 100</span>
            </div>
            <span className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {eyeLabel}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
            <div>
              <p className="text-[10px] text-slate-400">Fokus Audiens</p>
              <p className="font-bold text-slate-800">{vm?.gazeFocusPct ?? (vm?.eyeContactRatio ? Math.round(vm.eyeContactRatio * 100) : 65)}% Stabil</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Saccade / Lirikan</p>
              <p className="font-bold text-slate-800">{vm?.gazeUnfocusedPct && vm.gazeUnfocusedPct > 30 ? "Agak Liar" : "Tenang & Terkendali"}</p>
            </div>
          </div>
        </div>

        {/* Kartu 5: Pergerakan Tangan (10%) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <i className="bi bi-hand-index-thumb-fill text-brand-500" />
              NILAI DAN PENILAIAN PERGERAKAN TANGAN
            </span>
            <span className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-600">10%</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className={`text-3xl font-black ${scoreColor(handScore)}`}>{handScore}</span>
              <span className="ml-1 text-xs text-slate-400">/ 100</span>
            </div>
            <span className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {handLabel}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
            <div>
              <p className="text-[10px] text-slate-400">Frekuensi Gestur</p>
              <p className="font-bold text-slate-800">{vm?.handNaturalPct ?? 70}% Alami &amp; Terbuka</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Jeda Tangan</p>
              <p className="font-bold text-slate-800">{vm?.handStaticPct ?? 25}% Seimbang saat Poin</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KOTAK PENJELASAN TRANSPARAN "KENAPA NILAINYA BISA SEGITU" (GAMBAR 1) ── */}
      <div className="overflow-hidden rounded-2xl border-2 border-brand-500/30 bg-gradient-to-br from-brand-500/5 via-white to-brand-500/10 p-6 shadow-md">
        <div className="mb-4 flex items-center gap-2 border-b border-brand-500/20 pb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
            <i className="bi bi-lightbulb-fill text-base" />
          </span>
          <div>
            <h4 className="text-sm font-extrabold tracking-tight text-slate-900 md:text-base">
              LALU DISINI DIJELASKAN KENAPA NILAINYA BISA SEGITU (PENJELASAN &amp; REKOMENDASI AI)
            </h4>
            <p className="text-xs text-slate-500">
              Transparansi komputasi 5 indikator penilaian untuk {itemTitle} #{activeSegment.index + 1}
            </p>
          </div>
        </div>

        {/* Konten Kotak Penjelasan */}
        <div className="space-y-4">
          {/* 1. Mengapa Diberi Skor Ini (Penjelasan Utama) */}
          <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-600">
              <i className="bi bi-pin-angle-fill" />
              Ulasan &amp; Alasan Skor {itemTitle} Ini:
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              {fb?.why_explanation ||
                fb?.comment ||
                `Pada ${itemTitle} ini, penjelasan Anda tersampaikan dengan skor kecocokan ${relevanceScore}/100. Kecepatan bicara tercatat ${segWps || "2.1"} kata/detik dengan tempo ${speedLabel}.`}
            </p>
          </div>

          {/* 2. Rincian Poin & Alasan Pengurangan Nilai */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Poin Kelebihan */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
                <i className="bi bi-check-circle-fill text-emerald-600" />
                Poin Kuat yang Tersampaikan ({fb?.good?.length ?? 0}):
              </p>
              {fb?.good && fb.good.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {fb.good.map((g, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 text-emerald-600 font-bold">
                        <i className="bi bi-check2" />
                      </span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs italic text-slate-500">Seluruh materi pembuka disampaikan dengan wajar.</p>
              )}
            </div>

            {/* Alasan Pengurangan Poin / Missing */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
                <i className="bi bi-exclamation-triangle-fill text-amber-600" />
                Alasan Pengurangan Poin:
              </p>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {monotonWords.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-amber-600">[-{monotonWords.length * 5}]</span>
                    <span>Kata monoton berulang: <span className="font-mono font-semibold">{monotonWords.join(", ")}</span></span>
                  </li>
                )}
                {tidakBakuWords.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-amber-600">[-{tidakBakuWords.length * 2}]</span>
                    <span>Kata tidak baku / informal: <span className="font-mono font-semibold">{tidakBakuWords.join(", ")}</span></span>
                  </li>
                )}
                {kasarWords.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-rose-600">[-{kasarWords.length * 20}]</span>
                    <span>Kata tidak pantas terdeteksi: <span className="font-mono font-semibold">{kasarWords.join(", ")}</span></span>
                  </li>
                )}
                {fb?.missing && fb.missing.length > 0 ? (
                  fb.missing.map((m, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 text-amber-500 font-bold">
                        <i className="bi bi-dash" />
                      </span>
                      <span>Materi terlewat: {m}</span>
                    </li>
                  ))
                ) : (
                  monotonWords.length === 0 && tidakBakuWords.length === 0 && kasarWords.length === 0 && (
                    <li className="text-xs italic text-slate-500">Tidak ada penalti potongan poin signifikan pada sesi ini.</li>
                  )
                )}
              </ul>
            </div>
          </div>

          {/* 3. CONTOH JAWABAN / NARASI YANG SEHARUSNYA (FITUR BARU UPDATE 24) */}
          <div className="overflow-hidden rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-white to-brand-500/5 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-brand-500/15 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white shadow-sm">
                  <i className="bi bi-patch-check-fill text-sm" />
                </span>
                <div>
                  <h5 className="text-xs font-black tracking-wide uppercase text-slate-900 flex flex-wrap items-center gap-1.5">
                    <span>Contoh Jawaban / Narasi yang Seharusnya</span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-500/20">
                      Standar Ideal 100/100
                    </span>
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    Acuan kalimat terstruktur dan diksi profesional yang direkomendasikan AI
                  </p>
                </div>
              </div>

              {/* Action Buttons: On-demand AI Expansion, TTS, Copy, Mode Bersisian */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {!hasExpanded ? (
                  <button
                    type="button"
                    onClick={fetchExpandedModelAnswer}
                    disabled={loadingModelAnswer}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/90 px-2.5 py-1.5 text-xs font-bold text-brand-700 shadow-sm transition hover:bg-brand-100 disabled:opacity-60"
                    title="Perluas rekomendasi jawaban ideal mendalam via AI"
                  >
                    <i className={loadingModelAnswer ? "bi bi-arrow-repeat animate-spin text-brand-600" : "bi bi-stars text-brand-600"} />
                    <span>{loadingModelAnswer ? "Menyusun..." : "Perluas Rekomendasi (AI)"}</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    <i className="bi bi-patch-check-fill text-emerald-600" />
                    AI Terperinci
                  </span>
                )}
                {modelAnswer && (
                  <button
                    type="button"
                    onClick={() => handleSpeak(modelAnswer)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition shadow-sm border ${
                      isSpeaking
                        ? "bg-rose-50 text-rose-700 border-rose-300 animate-pulse"
                        : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                    }`}
                    title="Dengarkan contoh pelafalan kalimat ini"
                  >
                    <i className={isSpeaking ? "bi bi-stop-circle-fill text-rose-600" : "bi bi-volume-up-fill text-brand-600"} />
                    <span>{isSpeaking ? "Hentikan" : "Dengarkan"}</span>
                  </button>
                )}
                {modelAnswer && (
                  <button
                    type="button"
                    onClick={() => handleCopy(modelAnswer)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    title="Salin contoh teks jawaban"
                  >
                    <i className={copied ? "bi bi-check2 text-emerald-600" : "bi bi-clipboard text-slate-500"} />
                    <span>{copied ? "Tersalin!" : "Salin"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCompareMode(!isCompareMode)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition shadow-sm border ${
                    isCompareMode
                      ? "bg-brand-500 text-white border-brand-600 shadow-brand-500/20"
                      : "bg-white text-brand-700 hover:bg-brand-50 border-brand-200"
                  }`}
                  title="Beralih ke mode komparasi bersisian"
                >
                  <i className="bi bi-layout-split" />
                  <span>{isCompareMode ? "Tutup Komparasi" : "Komparasi Bersisian"}</span>
                </button>
              </div>
            </div>

            {/* Mode Komparasi Bersisian (Side-by-Side) */}
            {isCompareMode ? (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* Kolom Kiri: Narasi Asli Anda */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500 border-b border-slate-100 pb-2">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <i className="bi bi-mic text-slate-500" />
                      Narasi Asli Anda
                    </span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${scoreBg(relevanceScore)}`}>
                      Skor: {relevanceScore}/100
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700 italic min-h-[70px]">
                    {activeSegment.transcript ? `"${activeSegment.transcript}"` : "(Tidak ada transkrip terekam)"}
                  </p>
                  <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-600">Catatan Evaluasi:</p>
                    {monotonWords.length > 0 && (
                      <p className="text-amber-700 flex items-center gap-1">
                        <i className="bi bi-arrow-repeat text-amber-500" />
                        Monoton: {monotonWords.join(", ")}
                      </p>
                    )}
                    {fb?.missing && fb.missing.length > 0 && (
                      <p className="text-amber-700 flex items-center gap-1">
                        <i className="bi bi-exclamation-circle text-amber-500" />
                        Terlewat: {fb.missing.join("; ")}
                      </p>
                    )}
                    {monotonWords.length === 0 && (!fb?.missing || fb.missing.length === 0) && (
                      <p className="text-emerald-700 flex items-center gap-1">
                        <i className="bi bi-check2-circle text-emerald-500" />
                        Penyampaian cukup solid dan bebas kata kasar.
                      </p>
                    )}
                  </div>
                </div>

                {/* Kolom Kanan: Contoh Jawaban Ideal */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-emerald-800 border-b border-emerald-500/15 pb-2">
                    <span className="flex items-center gap-1.5">
                      <i className="bi bi-stars text-emerald-600" />
                      Contoh Jawaban yang Seharusnya
                    </span>
                    <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
                      Skor: 100/100
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-800 font-medium min-h-[70px]">
                    &ldquo;{modelAnswer}&rdquo;
                  </p>
                  <div className="mt-3 border-t border-emerald-500/15 pt-2 text-[11px] text-emerald-900 space-y-1">
                    <p className="font-semibold text-emerald-800">Keunggulan Struktur Ideal:</p>
                    {modelHighlights.slice(0, 2).map((h, idx) => (
                      <p key={idx} className="flex items-start gap-1">
                        <i className="bi bi-check2 text-emerald-600 font-bold mt-0.5" />
                        <span>{h}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Tampilan Normal Card */
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-brand-500/20 bg-white/95 p-4 shadow-sm">
                  <p className="text-sm leading-relaxed text-slate-800 font-medium">
                    &ldquo;{modelAnswer}&rdquo;
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-lg px-2.5 py-1">
                      <i className="bi bi-clock-history text-slate-400" />
                      Estimasi Bicara: ~{targetDurationSec} detik (~130 WPM)
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-lg px-2.5 py-1">
                      <i className="bi bi-chat-left-text text-slate-400" />
                      {modelAnswer.split(/\s+/).filter(Boolean).length} kata
                    </span>
                  </div>
                </div>

                {/* Highlights keunggulan jawaban ideal */}
                {modelHighlights.length > 0 && (
                  <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3 text-xs">
                    <p className="mb-1.5 font-bold uppercase tracking-wider text-emerald-800 text-[10px] flex items-center gap-1">
                      <i className="bi bi-stars text-emerald-600" />
                      Mengapa Kalimat Ini Efektif &amp; Berbobot Tinggi:
                    </p>
                    <ul className="space-y-1 text-slate-700">
                      {modelHighlights.map((hl, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold">
                            <i className="bi bi-check2-circle text-xs" />
                          </span>
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Rekomendasi Perbaikan Sesi Ini */}
          <div className="rounded-xl border border-brand-500/20 bg-white p-4 shadow-sm">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-600">
              <i className="bi bi-compass-fill" />
              Rekomendasi Perbaikan Khusus {itemTitle} #{activeSegment.index + 1}:
            </p>
            <p className="text-xs leading-relaxed text-slate-700">
              {va?.vocab_comment ||
                (fb?.missing?.length
                  ? `Fokuskan elaborasi pada aspek ${fb.missing.join(", ")} dengan tempo bicara stabil di rentang 110-150 WPM.`
                  : "Pertahankan ketenangan berbicara, pertahankan kontak mata dengan audiens, dan biarkan gestur tangan bergerak terbuka secara proporsional.")}
            </p>
          </div>

          {/* 5. Tip Latihan Ulang Cepat (Task 6H-RS) */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <i className="bi bi-lightbulb-fill text-indigo-600 text-base shrink-0" />
              <span>Sudah membaca contoh jawaban ideal &amp; poin kunci di atas? Coba latihan berbicara ulang sekarang dengan materi yang sama untuk meningkatkan skor Anda.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Lightbox Zoom Slide Resolusi Penuh (Update 21) ── */}
      {zoomImageUrl && (
        <div
          onClick={() => setZoomImageUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm transition"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-black/50 px-4 py-2.5 text-white">
              <span className="flex items-center gap-2 text-xs font-bold">
                <i className="bi bi-file-earmark-slides text-brand-400" />
                Pratinjau Resolusi Penuh — Slide #{activeSegment.index + 1}
              </span>
              <button
                type="button"
                onClick={() => setZoomImageUrl(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
                title="Tutup (ESC)"
              >
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-black/40">
              <img
                src={zoomImageUrl}
                alt={`Slide ${activeSegment.index + 1} Full`}
                className="max-h-[80vh] max-w-[85vw] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
