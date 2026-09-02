"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  sessionKind,
  sessionHref,
  KIND_LABEL,
  KIND_ICON,
  STATUS_BADGE,
  type HistoryRow,
} from "@/lib/simulationHistory";

export default function QuickDetailModal({
  row,
  onClose,
}: {
  row: HistoryRow | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (row) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [row, onClose]);

  if (!row) return null;

  const { session, scores, feedback } = row;
  const kind = sessionKind(session);
  const statusInfo = STATUS_BADGE[session.status] ?? STATUS_BADGE.done;
  const href = sessionHref(session);

  // Judul Sesi
  const title =
    (session.context as { title?: string; role?: string } | null)?.title ||
    (session.context as { title?: string; role?: string } | null)?.role ||
    KIND_LABEL[kind];

  const formattedDate = new Date(session.created_at).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const overall = scores?.overall;
  const overallBadgeClass =
    overall == null
      ? "bg-slate-100 text-slate-500"
      : overall >= 80
      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
      : overall >= 60
      ? "bg-brand-500/10 text-brand-600 border border-brand-500/20"
      : "bg-amber-500/10 text-amber-600 border border-amber-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm transition-opacity">
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-semibold text-slate-700">
                <i className={`bi ${KIND_ICON[kind]}`} />
                {KIND_LABEL[kind]}
              </span>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
            <p className="text-xs text-slate-400">📅 {formattedDate}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            title="Tutup Modal"
          >
            ✕
          </button>
        </div>

        {/* Isi Modal */}
        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-6">
          {/* Ringkasan Skor Utama */}
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Metrik Penilaian Utama
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className={`rounded-xl p-4 text-center ${overallBadgeClass}`}>
                <p className="text-xs font-semibold">Skor Total</p>
                <p className="mt-1 text-2xl font-black">{overall ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-xs font-semibold text-slate-500">Skor Isi</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {scores?.content ?? "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-xs font-semibold text-slate-500">Skor Penyampaian</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {scores?.delivery ?? "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Metrik Suara & Visual */}
          {scores?.detail && (
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                Detail Penyampaian &amp; Visual
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-100 bg-surface-2 p-3 text-center">
                  <p className="text-[11px] font-medium text-slate-500">Tempo Bicara (WPM)</p>
                  <p className="mt-0.5 text-base font-bold text-slate-800">
                    {scores.detail.wpm_avg != null ? `${scores.detail.wpm_avg} wpm` : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-surface-2 p-3 text-center">
                  <p className="text-[11px] font-medium text-slate-500">Kata Pengisi</p>
                  <p className="mt-0.5 text-base font-bold text-slate-800">
                    {scores.detail.filler_per_min != null ? `${scores.detail.filler_per_min}/m` : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-surface-2 p-3 text-center">
                  <p className="text-[11px] font-medium text-slate-500">Kontak Mata Visual</p>
                  <p className="mt-0.5 text-base font-bold text-slate-800">
                    {scores.detail.eye_contact != null
                      ? `${Math.round(scores.detail.eye_contact * 100)}%`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Ringkasan Evaluasi AI */}
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Evaluasi AI &amp; Umpan Balik
            </h3>
            {feedback?.summary ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
                  <p className="text-xs font-semibold text-brand-600">Catatan Ringkasan</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">
                    {feedback.summary}
                  </p>
                </div>

                {feedback.strengths && feedback.strengths.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <p className="mb-2 text-xs font-semibold text-emerald-700">
                      🌟 Poin Kelebihan (Strengths)
                    </p>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {feedback.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-500">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {feedback.improvements && feedback.improvements.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <p className="mb-2 text-xs font-semibold text-amber-700">
                      💡 Saran Perbaikan (Improvements)
                    </p>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {feedback.improvements.map((imp, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-500">•</span>
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                {feedback?.unavailable_reason ||
                  "Ringkasan evaluasi AI belum tersedia untuk sesi ini."}
              </div>
            )}
          </div>
        </div>

        {/* Footer Modal */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Tutup
          </button>
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-brand-600"
          >
            Buka Laporan Lengkap ➔
          </Link>
        </div>
      </div>
    </div>
  );
}
