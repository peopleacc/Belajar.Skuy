import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import RescoreButton from "@/components/simulation/RescoreButton";
import StartQaButton from "@/components/simulation/StartQaButton";
import { getSessionUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Hasil Sesi — belajar.skuy",
};

const CARD = "rounded-sm bg-white shadow-card";

type TimelineBucket = { t: number; eye: number | null; posture: number | null; gesture: number | null };

type SegmentRow = {
  index: number;
  prompt_text: string | null;
  transcript: string | null;
  speech_metrics: { wpm: number | null; fillerCount: number; durationMs: number } | null;
  visual_metrics: {
    eyeContactRatio: number | null;
    postureScore: number | null;
    gestureRate: number | null;
    framesSampled: number;
    timeline: TimelineBucket[];
  } | null;
};

type PerSlideFeedback = {
  index: number;
  match_score: number;
  good: string[];
  missing: string[];
  comment: string;
};

type ReportRow = {
  scores: {
    overall: number | null;
    content: number | null;
    delivery: number | null;
    ai_available: boolean;
    detail?: {
      wpm_avg: number | null;
      filler_per_min: number | null;
      eye_contact: number | null;
      posture: number | null;
    };
  };
  feedback: {
    summary?: string;
    qualitative_note?: string;
    per_slide?: PerSlideFeedback[];
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
  if (v >= 70) return "text-emerald-600";
  if (v >= 50) return "text-amber-600";
  return "text-rose-500";
}

/** Linimasa kontak mata sepanjang sesi (bucket 10s lintas slide) — SVG polos tanpa lib. */
function EyeTimeline({ segments }: { segments: SegmentRow[] }) {
  const points: { eye: number; slide: number }[] = [];
  const boundaries: number[] = [];
  for (const seg of segments) {
    boundaries.push(points.length);
    for (const b of seg.visual_metrics?.timeline ?? []) {
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
      <p className="mb-1 text-sm font-bold">Linimasa Menghadap Kamera</p>
      <p className="mb-3 text-[11px] text-slate-400">
        Per ±10 detik. Garis putus-putus = ganti slide. Perkiraan dari arah kepala — melihat
        catatan/slide sesekali itu wajar.
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

  // RLS memastikan hanya sesi milik user ini yang terbaca — id orang lain = 404.
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("simulation_sessions")
    .select("id, type, status, settings, context, created_at, finished_at")
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound();

  // Fitur BE/BF — halaman ini melayani presentasi & wawancara; yang berbeda cuma
  // istilahnya (slide vs pertanyaan) karena bentuk laporannya memang sama.
  const isInterview = session.type === "interview";
  const isQa = Boolean(session.context?.fromSessionId);
  const itemWord = isInterview ? "Pertanyaan" : "Slide";
  const judul = isQa
    ? "Tanya-Jawab Presentasi"
    : isInterview
      ? `Simulasi Wawancara${session.context?.role ? ` · ${session.context.role}` : ""}`
      : "Simulasi Presentasi";

  const [{ data: segments }, { data: reportRow }] = await Promise.all([
    supabase
      .from("simulation_segments")
      .select("index, prompt_text, transcript, speech_metrics, visual_metrics")
      .eq("session_id", id)
      .order("index"),
    supabase
      .from("simulation_reports")
      .select("scores, feedback")
      .eq("session_id", id)
      .maybeSingle(),
  ]);

  const rows = (segments ?? []) as SegmentRow[];
  const report = (reportRow ?? null) as ReportRow | null;
  const perSlideFb = new Map<number, PerSlideFeedback>(
    (report?.feedback.per_slide ?? []).map((p) => [p.index, p])
  );
  const totalItems = isInterview
    ? (session.context?.questions ?? []).length
    : (session.context?.slides ?? []).length;
  const totalMs = rows.reduce((a, r) => a + (r.speech_metrics?.durationMs ?? 0), 0);
  const selesai = session.status === "done";

  return (
    <main className="mx-auto max-w-6xl p-8">
        <nav className="mb-4 text-xs text-slate-500">
          <Link href="/simulation" className="hover:text-brand-500">
            Simulasi
          </Link>{" "}
          / <span className="font-medium text-brand-500">Hasil Sesi</span>
        </nav>

        {/* ── Skor ─────────────────────────────────────────────── */}
        <div className={`${CARD} mb-6 p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold tracking-tight">{judul}</h1>
            <span className="text-xs text-slate-500">
              {new Date(session.created_at).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>

          {report ? (
            <>
              <div className="mt-5 grid grid-cols-3 gap-4">
                {[
                  { label: "Skor Akhir", value: report.scores.overall },
                  { label: "Isi Penjelasan", value: report.scores.content },
                  { label: "Penyampaian", value: report.scores.delivery },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-surface-2 px-4 py-4 text-center">
                    <p className={`text-3xl font-extrabold ${scoreTone(s.value)}`}>
                      {s.value ?? "—"}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                {[
                  { label: "Durasi", value: fmtDuration(totalMs) },
                  { label: "Tempo", value: report.scores.detail?.wpm_avg != null ? `${report.scores.detail.wpm_avg} kpm` : "—" },
                  { label: "Pengisi/mnt", value: report.scores.detail?.filler_per_min ?? "—" },
                  { label: "Hadap kamera", value: report.scores.detail?.eye_contact != null ? `${Math.round(report.scores.detail.eye_contact * 100)}%` : "—" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-surface-2 px-2 py-2">
                    <p className="text-sm font-bold">{s.value}</p>
                    <p className="text-[10px] text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {!report.scores.ai_available && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-500/10 px-3 py-2">
                  <p className="text-xs text-amber-600">
                    {report.feedback.unavailable_reason ??
                      "Penilaian AI belum tersedia — skor di atas dari metrik terukur saja."}
                  </p>
                  <RescoreButton sessionId={id} />
                </div>
              )}

              {/* Fitur BF — tanya-jawab hanya untuk PRESENTASI yang sudah punya
                  ringkasan (sumber pertanyaannya). Sesi wawancara tidak punya
                  "audiens bertanya" lagi setelahnya. */}
              {!isInterview && report.feedback.summary && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-500/5 px-4 py-3">
                  <p className="text-xs text-slate-500">
                    Siap ditanya audiens? AI akan menyusun pertanyaan dari materi
                    presentasimu — terutama bagian yang penjelasannya masih lemah.
                  </p>
                  <StartQaButton sessionId={id} />
                </div>
              )}
            </>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-500/5 px-4 py-3">
              <p className="text-sm text-slate-500">
                {selesai
                  ? "Sesi selesai tapi belum dinilai."
                  : "Sesi ini belum selesai — laporan muncul setelah presentasi dituntaskan."}
              </p>
              {selesai && <RescoreButton sessionId={id} label="🧮 Nilai Sekarang" />}
            </div>
          )}
        </div>

        {/* ── Umpan balik AI ───────────────────────────────────── */}
        {report?.scores.ai_available && (
          <div className={`${CARD} mb-6 p-6`}>
            {report.feedback.qualitative_note && (
              <p className="rounded-xl bg-brand-500/5 px-4 py-3 text-sm leading-relaxed">
                💬 {report.feedback.qualitative_note}
              </p>
            )}
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-600">
                  Yang sudah baik
                </p>
                <ul className="space-y-2">
                  {(report.feedback.strengths ?? []).map((s) => (
                    <li key={s} className="flex gap-2 text-sm">
                      <i className="bi bi-check-circle-fill mt-0.5 shrink-0 text-emerald-500"></i>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-500">
                  Latihan berikutnya
                </p>
                <ul className="space-y-2">
                  {(report.feedback.improvements ?? []).map((s) => (
                    <li key={s} className="flex gap-2 text-sm">
                      <i className="bi bi-arrow-up-circle mt-0.5 shrink-0 text-brand-500"></i>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 border-t border-border pt-3 text-[11px] text-slate-400">
              Catatan visual = perkiraan dari kamera (indikator latihan, bukan penilaian pasti) —
              akurasinya terbatas dan bisa keliru untuk sebagian orang.
            </p>
          </div>
        )}

        {/* ── Linimasa ─────────────────────────────────────────── */}
        <div className="mb-6">
          <EyeTimeline segments={rows} />
        </div>

        {/* ── Per slide ────────────────────────────────────────── */}
        <div className="space-y-4">
          {rows.length === 0 && (
            <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>
              Belum ada segmen yang tersimpan di sesi ini.
            </div>
          )}
          {rows.map((r) => {
            const fb = perSlideFb.get(r.index);
            return (
              <div key={r.index} className={`${CARD} p-6`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold">
                    {itemWord} {r.index + 1}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      / {totalItems}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {fb && (
                      <span className={`rounded-full bg-surface-2 px-2.5 py-1 font-bold ${scoreTone(fb.match_score)}`}>
                        kecocokan {fb.match_score}
                      </span>
                    )}
                    {r.speech_metrics?.durationMs != null && (
                      <span className="rounded-full bg-surface-2 px-2.5 py-1">
                        ⏱ {fmtDuration(r.speech_metrics.durationMs)}
                      </span>
                    )}
                    {r.speech_metrics?.wpm != null && (
                      <span className="rounded-full bg-surface-2 px-2.5 py-1">
                        {r.speech_metrics.wpm} kata/menit
                      </span>
                    )}
                    {(r.speech_metrics?.fillerCount ?? 0) > 0 && (
                      <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-600">
                        {r.speech_metrics!.fillerCount} kata pengisi
                      </span>
                    )}
                    {r.visual_metrics?.eyeContactRatio != null && (
                      <span className="rounded-full bg-surface-2 px-2.5 py-1">
                        👁 {Math.round(r.visual_metrics.eyeContactRatio * 100)}%
                      </span>
                    )}
                  </div>
                </div>

                {r.prompt_text && (
                  <p
                    className={`mb-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-slate-500 ${
                      isInterview ? "" : "line-clamp-2"
                    }`}
                  >
                    <span className="font-semibold">
                      {isInterview ? "Pertanyaan:" : "Isi slide:"}
                    </span>{" "}
                    {r.prompt_text}
                  </p>
                )}

                {r.transcript ? (
                  <p className="text-sm leading-relaxed">{r.transcript}</p>
                ) : (
                  <p className="text-sm italic text-slate-400">
                    (tidak ada transkrip — tanpa mikrofon, atau transkripsi gagal)
                  </p>
                )}

                {fb && (
                  <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
                    <p className="text-slate-600">{fb.comment}</p>
                    {fb.good.length > 0 && (
                      <p className="text-emerald-600">✓ {fb.good.join(" · ")}</p>
                    )}
                    {fb.missing.length > 0 && (
                      <p className="text-amber-600">△ Terlewat: {fb.missing.join(" · ")}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
    </main>
  );
}
