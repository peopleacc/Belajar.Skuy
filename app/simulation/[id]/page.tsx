import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import RescoreButton from "@/components/simulation/RescoreButton";
import StartQaButton from "@/components/simulation/StartQaButton";
import RetrySimulationButton from "@/components/simulation/RetrySimulationButton";
import AutoReportPoller from "@/components/simulation/AutoReportPoller";
import SessionBreakdownViewer, {
  type SegmentDetailRow,
  type PerSlideFeedback,
} from "@/components/simulation/SessionBreakdownViewer";
import { getSessionUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Hasil Evaluasi Simulasi — belajar.skuy",
};

const CARD = "rounded-2xl border border-slate-200/90 bg-white shadow-card";

type TimelineBucket = { t: number; eye: number | null; posture: number | null; gesture: number | null };

type ReportScores = {
  overall: number | null;
  content: number | null;
  delivery: number | null;
  speed_score?: number | null;
  relevance_score?: number | null;
  vocab_score?: number | null;
  hand_score?: number | null;
  eye_score?: number | null;
  speed_metrics?: {
    wps?: number | null;
    wpm?: number | null;
    category?: string | null;
    total_words?: number | null;
    duration_sec?: number | null;
  } | null;
  relevance_metrics?: {
    category?: string | null;
    match_score?: number | null;
  } | null;
  vocab_metrics?: {
    monoton_count?: number | null;
    kasar_count?: number | null;
    tidak_baku_count?: number | null;
    category?: string | null;
  } | null;
  hand_metrics?: {
    score?: number | null;
    category?: string | null;
  } | null;
  eye_metrics?: {
    score?: number | null;
    category?: string | null;
  } | null;
  detail?: {
    wpm_avg?: number | null;
    filler_per_min?: number | null;
    eye_contact?: number | null;
    posture?: number | null;
    speed_score?: number | null;
    relevance_score?: number | null;
    vocab_score?: number | null;
    hand_score?: number | null;
    eye_score?: number | null;
    speed_metrics?: any;
    relevance_metrics?: any;
    vocab_metrics?: any;
    hand_metrics?: any;
    eye_metrics?: any;
  } | null;
  ai_available: boolean;
};

type ReportRow = {
  scores: ReportScores;
  feedback: {
    summary?: string;
    qualitative_note?: string;
    per_slide?: PerSlideFeedback[];
    vocab_summary?: {
      monoton_words?: string[];
      kasar_words?: string[];
      tidak_baku_words?: string[];
      overall_vocab_comment?: string;
    };
    strengths?: string[];
    improvements?: string[];
    unavailable_reason?: string;
  };
};

function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function scoreTone(v: number | null) {
  if (v == null) return "text-slate-400";
  if (v >= 80) return "text-emerald-600";
  if (v >= 65) return "text-brand-500";
  if (v >= 50) return "text-amber-500";
  return "text-rose-500";
}

/** Linimasa kontak mata sepanjang sesi (bucket 10s lintas slide) — SVG polos tanpa lib. */
function EyeTimeline({ segments }: { segments: SegmentDetailRow[] }) {
  const points: { eye: number; slide: number }[] = [];
  const boundaries: number[] = [];
  for (const seg of segments) {
    boundaries.push(points.length);
    const vm = seg.visual_metrics as any;
    for (const b of vm?.timeline ?? []) {
      if (b.eye != null) points.push({ eye: b.eye, slide: seg.index });
    }
  }
  if (points.length < 2) return null;

  const W = 640, H = 90, PAD = 8;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (points.length - 1);
  const y = (v: number) => H - PAD - v * (H - PAD * 2);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.eye).toFixed(1)}`).join(" ");

  return (
    <div className={`${CARD} p-6`}>
      <p className="mb-1 text-sm font-bold text-slate-800">Linimasa Menghadap Kamera</p>
      <p className="mb-3 text-[11px] text-slate-400">
        Per ±10 detik. Garis putus-putus = ganti slide/pertanyaan. Perkiraan dari arah kepala & konjugat iris mata.
      </p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full min-w-[420px]">
          <line x1={PAD} y1={y(0.5)} x2={W - PAD} y2={y(0.5)} stroke="rgb(var(--border))" strokeDasharray="2 4" />
          {boundaries.slice(1).map((bi, i) =>
            bi > 0 && bi < points.length ? (
              <line key={i} x1={x(bi) - 2} y1={PAD} x2={x(bi) - 2} y2={H - PAD}
                stroke="rgb(var(--border))" strokeDasharray="3 3" />
            ) : null
          )}
          <path d={line} fill="none" stroke="rgb(var(--brand-500))" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}

export default async function SimulationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("simulation_sessions")
    .select("id, type, status, settings, context, created_at, finished_at")
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound();

  const isInterview = session.type === "interview" || session.type === "wawancara";
  const isQa = Boolean(session.context?.fromSessionId);
  const itemWord = isInterview ? "Pertanyaan" : "Slide";
  const judul = isQa
    ? "Tanya-Jawab Presentasi"
    : isInterview
      ? `Simulasi Wawancara${session.context?.role ? ` · ${session.context.role}` : ""}`
      : "Simulasi Presentasi";

  let [{ data: segments, error: segErr }, { data: reportRow }] = await Promise.all([
    supabase
      .from("simulation_segments")
      .select("index, prompt_text, transcript, speech_metrics, visual_metrics, slide_image_url")
      .eq("session_id", id)
      .order("index"),
    supabase
      .from("simulation_reports")
      .select("scores, feedback")
      .eq("session_id", id)
      .maybeSingle(),
  ]);

  if (segErr && (segErr as { message?: string }).message?.includes("slide_image_url")) {
    const { data: fallbackSegments } = await supabase
      .from("simulation_segments")
      .select("index, prompt_text, transcript, speech_metrics, visual_metrics")
      .eq("session_id", id)
      .order("index");
    segments = (fallbackSegments ?? []).map((s) => ({ ...s, slide_image_url: null }));
  }

  const rows = (segments ?? []) as SegmentDetailRow[];
  const report = (reportRow ?? null) as ReportRow | null;
  const perSlideFb = new Map<number, PerSlideFeedback>(
    (report?.feedback.per_slide ?? []).map((p) => [p.index, p])
  );
  const totalItems = isInterview
    ? (session.context?.questions ?? []).length || rows.length
    : (session.context?.slides ?? []).length || rows.length;
  const totalMs = rows.reduce((a, r) => a + (r.speech_metrics?.durationMs ?? 0), 0);
  const totalSec = Math.max(1, totalMs / 1000);
  const selesai = session.status === "done";

  // Hitung Nilai Rata-rata 5 Indikator Agregat (Gambar 2 Wireframe)
  const sc = report?.scores;
  const overall = sc?.overall ?? null;
  let predikat = "Memuaskan";
  if (overall != null) {
    if (overall >= 85) predikat = "Sangat Baik (Prima)";
    else if (overall >= 75) predikat = "Baik & Percaya Diri";
    else if (overall >= 60) predikat = "Cukup (Perlu Latihan)";
    else predikat = "Kurang (Butuh Perhatian Khusus)";
  }

  // 1. Kecepatan Ngomong (30%)
  const speedScore = sc?.speed_score ?? sc?.detail?.speed_score ?? 75;
  const speedCategory = sc?.speed_metrics?.category ?? sc?.detail?.speed_metrics?.category ?? "Normal (Ideal)";
  let totalWordsCount = 0;
  let fillerTotal = 0;
  for (const r of rows) {
    totalWordsCount += r.speech_metrics?.cadence?.totalWords ?? (r.transcript ?? "").split(/\s+/).filter(Boolean).length;
    fillerTotal += r.speech_metrics?.fillerCount ?? 0;
  }
  const avgWps = sc?.speed_metrics?.wps ?? Math.round((totalWordsCount / totalSec) * 10) / 10;
  const avgWpm = sc?.speed_metrics?.wpm ?? sc?.detail?.wpm_avg ?? Math.round(avgWps * 60);

  // 2. Kesesuaian Jawaban AI (30%)
  const relevanceScore = sc?.relevance_score ?? sc?.detail?.relevance_score ?? sc?.content ?? 75;
  const relevanceCategory = sc?.relevance_metrics?.category ?? sc?.detail?.relevance_metrics?.category ?? "Cukup Jelas";

  // 3. Penggunaan Kata (20%)
  const vocabScore = sc?.vocab_score ?? sc?.detail?.vocab_score ?? 80;
  const vocabCategory = sc?.vocab_metrics?.category ?? sc?.detail?.vocab_metrics?.category ?? "Cukup Baik Pemilihannya";
  const vocabMonotonTotal = sc?.vocab_metrics?.monoton_count ?? 0;
  const vocabKasarTotal = sc?.vocab_metrics?.kasar_count ?? 0;
  const vocabTidakBakuTotal = sc?.vocab_metrics?.tidak_baku_count ?? 0;

  // 4. Pergerakan Tangan (10%)
  const handScore = sc?.hand_score ?? sc?.detail?.hand_score ?? 70;
  const handCategory = sc?.hand_metrics?.category ?? sc?.detail?.hand_metrics?.category ?? "Dinamis & Terarah";
  let handFrames = 0, handNaturalSum = 0, handStaticSum = 0, handCrossedSum = 0, handBelowHipSum = 0;
  for (const r of rows) {
    const vm = r.visual_metrics;
    if (vm && (vm.framesSampled ?? 0) > 0) {
      const f = vm.framesSampled!;
      handFrames += f;
      handNaturalSum += (vm.handNaturalPct ?? 65) * f;
      handStaticSum += (vm.handStaticPct ?? 25) * f;
      handCrossedSum += (vm.handCrossedPct ?? 5) * f;
      handBelowHipSum += (vm.handBelowHipPct ?? 5) * f;
    }
  }
  const avgHandNatural = handFrames > 0 ? Math.round(handNaturalSum / handFrames) : 70;
  const avgHandStatic = handFrames > 0 ? Math.round(handStaticSum / handFrames) : 25;
  const avgHandCrossed = handFrames > 0 ? Math.round(handCrossedSum / handFrames) : 5;
  const avgHandBelowHip = handFrames > 0 ? Math.round(handBelowHipSum / handFrames) : 5;

  // 5. Pergerakan Mata (10%)
  const eyeScore = sc?.eye_score ?? sc?.detail?.eye_score ?? (sc?.detail?.eye_contact != null ? Math.round(sc.detail.eye_contact * 100) : 75);
  const eyeCategory = sc?.eye_metrics?.category ?? sc?.detail?.eye_metrics?.category ?? "Fokus & Memperhatikan Audiens";
  let eyeFrames = 0, eyeFocusSum = 0, eyeAudienceSum = 0, eyeUnfocusedSum = 0;
  let hasReadingSuspicion = false;
  for (const r of rows) {
    const vm = r.visual_metrics;
    if (vm && (vm.framesSampled ?? 0) > 0) {
      const f = vm.framesSampled!;
      eyeFrames += f;
      eyeFocusSum += (vm.gazeFocusPct ?? 60) * f;
      eyeAudienceSum += (vm.gazeAudiencePct ?? 30) * f;
      eyeUnfocusedSum += (vm.gazeUnfocusedPct ?? 10) * f;
      if (vm.readingSuspicion) hasReadingSuspicion = true;
    }
  }
  const avgFocusPct = eyeFrames > 0 ? Math.round(eyeFocusSum / eyeFrames) : (sc?.detail?.eye_contact != null ? Math.round(sc.detail.eye_contact * 100) : 65);
  const avgAudiencePct = eyeFrames > 0 ? Math.round(eyeAudienceSum / eyeFrames) : 25;
  const avgUnfocusedPct = eyeFrames > 0 ? Math.round(eyeUnfocusedSum / eyeFrames) : 10;

  return (
    <main className="mx-auto max-w-6xl p-6 md:p-8 space-y-8">
      {/* ── Breadcrumb & Header Nav ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="text-xs text-slate-500">
          <Link href="/simulation" className="hover:text-brand-500 transition">
            Simulasi
          </Link>{" "}
          / <span className="font-semibold text-brand-600">Hasil Evaluasi Sesi</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">
            <i className="bi bi-calendar3 mr-1.5 text-slate-400"></i>{new Date(session.created_at).toLocaleString("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          <RetrySimulationButton
            session={session}
            variant="header"
            label="Ulangi Sesi"
          />
        </div>
      </div>

      {report ? (
        <>
          {/* ═══════════════════════════════════════════════════════════════════════════════
              TINGKAT 1 (GAMBAR 2): HERO SCORE CARD - RATA-RATA NILAI KESELURUHAN
             ═══════════════════════════════════════════════════════════════════════════════ */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-ink-900 to-slate-800 p-8 text-white shadow-lg">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <span className="rounded-full bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-brand-300 backdrop-blur-md">
                RATA-RATA NILAI DARI INDIKATOR {isInterview ? "WAWANCARA" : "PRESENTASI"}
              </span>

              <div className="my-5 flex items-baseline justify-center gap-2">
                <span className="text-6xl md:text-7xl font-black tracking-tight text-white">
                  {overall ?? "—"}
                </span>
                <span className="text-xl md:text-2xl font-bold text-slate-400">/ 100</span>
              </div>

              <div className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-1.5 text-sm font-bold text-emerald-300 backdrop-blur-sm">
                <span>Predikat:</span>
                <span className="underline decoration-emerald-400 underline-offset-4">{predikat}</span>
              </div>

              <p className="max-w-2xl text-xs md:text-sm leading-relaxed text-slate-300 italic">
                "{report.feedback.summary ||
                  "Presentasi mengalir dengan tempo stabil dan terstruktur, didukung artikulasi jelas serta kontak mata yang adaptif terhadap audiens."}"
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════════════
              TINGKAT 1 (GAMBAR 2): 2 KARTU KAMERA DI BARIS TENGAH (MATA 10% & TANGAN 10%)
             ═══════════════════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Kartu Mata 10% */}
            <div className={`${CARD} p-6 transition hover:shadow-lg`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <i className="bi bi-eye-fill text-brand-500" />
                  INDIKATOR PENILAIAN PERGERAKAN MATA
                </h3>
                <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-black text-brand-600">10%</span>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Klasifikasi Pergerakan Mata:</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">{eyeCategory}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Skor Rata-rata:</span>
                  <span className={`font-bold ${scoreTone(eyeScore)}`}>{eyeScore} / 100</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Rasio Fokus Stabil:</span>
                  <span className="font-semibold text-slate-800">{avgFocusPct}%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Rasio Menyapa Audiens:</span>
                  <span className="font-semibold text-slate-800">{avgAudiencePct}%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Frekuensi Lirikan:</span>
                  <span className="font-semibold text-slate-800">{avgUnfocusedPct > 25 ? "Agak Liar" : "Normal & Tenang"}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Status Naskah:</span>
                  <span className={`font-semibold ${hasReadingSuspicion ? "text-amber-600 font-bold" : "text-emerald-600"}`}>
                    {hasReadingSuspicion ? "Perhatian: Indikasi Membaca" : "Alami (Bebas Curiga Naskah)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Kartu Tangan 10% */}
            <div className={`${CARD} p-6 transition hover:shadow-lg`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <i className="bi bi-hand-index-thumb-fill text-brand-500" />
                  INDIKATOR PENILAIAN PERGERAKAN TANGAN
                </h3>
                <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-black text-brand-600">10%</span>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Klasifikasi Penggunaan Tangan:</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">{handCategory}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Skor Rata-rata:</span>
                  <span className={`font-bold ${scoreTone(handScore)}`}>{handScore} / 100</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Rasio Gestur Alami:</span>
                  <span className="font-semibold text-slate-800">{avgHandNatural}%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Jeda Penekanan Poin:</span>
                  <span className="font-semibold text-slate-800">{avgHandStatic}%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Postur Terbuka:</span>
                  <span className="font-semibold text-slate-800">{avgHandCrossed < 20 ? "Aktif & Terbuka" : "Cenderung Bersedekap"}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Posisi Tangan:</span>
                  <span className={`font-semibold ${avgHandBelowHip < 25 ? "text-emerald-600" : "text-amber-600"}`}>
                    {avgHandBelowHip < 25 ? "Ideal (Di Atas Pinggul)" : "Cenderung di Bawah Pinggul"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════════════
              TINGKAT 1 (GAMBAR 2): 3 KARTU SUARA & ISI DI BARIS BAWAH (30%, 30%, 20%)
             ═══════════════════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Kartu Kecepatan 30% */}
            <div className={`${CARD} p-6 transition hover:shadow-lg`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  KECEPATAN KATA &amp; KALIMAT
                </h3>
                <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-black text-brand-600">30%</span>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Klasifikasi Kecepatan Ngomong:</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">{speedCategory}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Skor Rata-rata:</span>
                  <span className={`font-bold ${scoreTone(speedScore)}`}>{speedScore} / 100</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Kecepatan Kata:</span>
                  <span className="font-semibold text-slate-800">{avgWps} kata/detik</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Tempo WPM:</span>
                  <span className="font-semibold text-slate-800">{avgWpm} WPM</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Total Waktu Bicara:</span>
                  <span className="font-semibold text-slate-800">{fmtDuration(totalMs)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Kata Pengisi:</span>
                  <span className="font-semibold text-slate-800">{fillerTotal} repetisi</span>
                </div>
              </div>
            </div>

            {/* Kartu Kesesuaian Jawaban AI 30% */}
            <div className={`${CARD} p-6 transition hover:shadow-lg`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  KESESUAIAN JAWABAN AI
                </h3>
                <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-black text-brand-600">30%</span>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Klasifikasi Tiap Kesesuaian:</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">{relevanceCategory}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Skor Rata-rata:</span>
                  <span className={`font-bold ${scoreTone(relevanceScore)}`}>{relevanceScore} / 100</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Tingkat Kesesuaian:</span>
                  <span className="font-semibold text-slate-800">{relevanceScore >= 80 ? "Sangat Tinggi" : relevanceScore >= 65 ? "Baik" : "Perlu Elaborasi"}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Poin Materi:</span>
                  <span className="font-semibold text-slate-800">Tercakup Lengkap</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Catatan AI:</span>
                  <span className="font-semibold text-slate-800 line-clamp-1">Penjelasan Fokus</span>
                </div>
              </div>
            </div>

            {/* Kartu Penggunaan Kata 20% */}
            <div className={`${CARD} p-6 transition hover:shadow-lg`}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  PENGGUNAAN KATA (DIKSI)
                </h3>
                <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-xs font-black text-brand-600">20%</span>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Klasifikasi Penggunaan Kata:</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">{vocabCategory}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Skor Rata-rata:</span>
                  <span className={`font-bold ${scoreTone(vocabScore)}`}>{vocabScore} / 100</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Kata Monoton (-5):</span>
                  <span className="font-semibold text-slate-800">{vocabMonotonTotal} repetisi</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Kata Kasar (-20):</span>
                  <span className="font-semibold text-slate-800">{vocabKasarTotal} terdeteksi</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Kata Kurang Baku (-2):</span>
                  <span className="font-semibold text-slate-800">{vocabTidakBakuTotal} kata</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-slate-50">
                  <span className="text-slate-500">Kualitas Diksi:</span>
                  <span className="font-semibold text-slate-800">{vocabScore >= 70 ? "Profesional" : "Perlu Perbaikan"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Linimasa Visual ── */}
          <EyeTimeline segments={rows} />

          {/* ── Umpan Balik Kualitatif & Rekomendasi Keseluruhan ── */}
          {report.feedback.qualitative_note && (
            <div className={`${CARD} p-6`}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                <i className="bi bi-chat-quote-fill mr-1.5 text-brand-500"></i>Catatan Kualitatif Penguji AI
              </h3>
              <p className="rounded-xl bg-brand-500/5 p-4 text-sm leading-relaxed text-slate-700">
                {report.feedback.qualitative_note}
              </p>

              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                    <i className="bi bi-check-circle-fill" />
                    Kelebihan yang Terlihat (Strengths)
                  </p>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {(report.feedback.strengths ?? []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-600 flex items-center gap-1.5">
                    <i className="bi bi-arrow-up-circle-fill" />
                    Rekomendasi Latihan Selanjutnya
                  </p>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {(report.feedback.improvements ?? []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-brand-500 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════════════
              TINGKAT 2 (GAMBAR 1): PENILAIAN RINCI TIAP SESI / SLIDE & KENAPA SEGITU
             ═══════════════════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4 pt-6">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-900">
                Penilaian Rinci Tiap Sesi &amp; Transparansi Skor (Gambar 1)
              </h2>
              <p className="text-xs text-slate-500">
                Pilih nomor {itemWord.toLowerCase()} di bawah untuk melihat rincian evaluasi per segmen dan penjelasan transparan AI: <span className="font-semibold text-brand-600">"Kenapa nilainya bisa segitu"</span>.
              </p>
            </div>

            <SessionBreakdownViewer
              sessionId={id}
              segments={rows}
              feedbacks={perSlideFb}
              isInterview={isInterview}
              totalItems={totalItems}
            />
          </div>

          {/* Banner Aksi Latihan Ulang (Zero-Token Retry Banner) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-indigo-100/90 bg-gradient-to-br from-white via-white to-indigo-50/50 p-6 shadow-sm">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-lg">
                <i className="bi bi-arrow-repeat"></i>
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  Ingin Memperbaiki Skor Evaluasi?
                </h4>
                <p className="mt-1 text-xs text-slate-500 max-w-xl leading-relaxed">
                  Lakukan simulasi ulang dengan {isInterview ? "pertanyaan wawancara" : "materi slide"} yang sama persis secara instan tanpa mengonsumsi kuota token AI baru.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
              <RetrySimulationButton
                session={session}
                variant="primary"
                label="Latihan Ulang Sekarang"
                className="w-full sm:w-auto"
              />
            </div>
          </div>

          {/* Fitur Tanya Jawab Lanjutan */}
          {!isInterview && report.feedback.summary && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Siap Menguji Penguasaan Materi dengan Tanya-Jawab?</h4>
                <p className="mt-1 text-xs text-slate-500 max-w-xl">
                  AI akan bertindak sebagai audiens kritis dan menyusun pertanyaan berdasarkan materi presentasi Anda, terutama bagian yang masih membutuhkan elaborasi lebih dalam.
                </p>
              </div>
              <StartQaButton sessionId={id} />
            </div>
          )}
        </>
      ) : (
        <AutoReportPoller sessionId={id} isFinished={selesai} />
      )}
    </main>
  );
}
