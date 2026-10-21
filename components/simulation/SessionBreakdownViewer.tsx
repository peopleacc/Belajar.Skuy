"use client";

import { useState } from "react";

export type PerSlideFeedback = {
  index: number;
  match_score: number;
  why_explanation?: string | null;
  good: string[];
  missing: string[];
  comment: string;
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
  segments,
  feedbacks,
  isInterview,
  totalItems,
}: {
  segments: SegmentDetailRow[];
  feedbacks: Map<number, PerSlideFeedback>;
  isInterview: boolean;
  totalItems: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

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

      {/* ── Slide Deck Preview / Pertanyaan Teks ── */}
      {activeSegment.prompt_text && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5 text-brand-600">
              <i className={isInterview ? "bi bi-chat-left-quote-fill" : "bi bi-file-earmark-slides-fill"} />
              {isInterview ? "Pertanyaan Sesi Wawancara" : `Materi Slide #${activeSegment.index + 1}`}
            </span>
            <span>Durasi: {fmtDuration(activeSegment.speech_metrics?.durationMs ?? 0)}</span>
          </div>
          <p className="text-sm font-medium leading-relaxed text-slate-800">
            {activeSegment.prompt_text}
          </p>
        </div>
      )}

      {/* ── Narasi Transkrip Sesi Ini ── */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
          🎙️ Transkrip Narasi Anda pada Sesi Ini:
        </p>
        <p className="text-sm leading-relaxed text-slate-700 italic">
          {activeSegment.transcript ? `"${activeSegment.transcript}"` : "(Tidak ada transkrip terekam pada sesi ini)"}
        </p>
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
              <p className="font-bold text-slate-800">{vm?.handNaturalPct ?? 70}% Alami & Terbuka</p>
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
            💡
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

        {/* 1. Mengapa Diberi Skor Ini (Penjelasan Utama) */}
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-600">
              📌 Ulasan &amp; Alasan Skor {itemTitle} Ini:
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
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                ✓ Poin Kuat yang Tersampaikan ({fb?.good?.length ?? 0}):
              </p>
              {fb?.good && fb.good.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {fb.good.map((g, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 text-emerald-500 font-bold">•</span>
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
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">
                △ Alasan Pengurangan Poin:
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
                      <span className="text-amber-500 font-bold">•</span>
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

          {/* 3. Rekomendasi Perbaikan Sesi Ini */}
          <div className="rounded-xl border border-brand-500/20 bg-white p-4 shadow-sm">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-600">
              🚀 Rekomendasi Perbaikan Khusus {itemTitle} #{activeSegment.index + 1}:
            </p>
            <p className="text-xs leading-relaxed text-slate-700">
              {va?.vocab_comment ||
                (fb?.missing?.length
                  ? `Fokuskan elaborasi pada aspek ${fb.missing.join(", ")} dengan tempo bicara stabil di rentang 110-150 WPM.`
                  : "Pertahankan ketenangan berbicara, pertahankan kontak mata dengan audiens, dan biarkan gestur tangan bergerak terbuka secara proporsional.")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
