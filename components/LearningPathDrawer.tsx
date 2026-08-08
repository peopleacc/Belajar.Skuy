"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { ChapterState } from "@/lib/chapterState";

export type DrawerChapter = {
  id: string;
  number: number;
  title: string;
  state: ChapterState;
};

export type DrawerSubStep = {
  /** Label langkah materi: "Pengantar" atau judul subbab tingkat atas. */
  title: string;
};

const STATE_LABEL: Record<ChapterState, string> = {
  completed: "Selesai",
  available: "Siap dipelajari",
  generate: "Belum digenerate",
  locked: "Terkunci",
};

/** Fitur Y — drawer learning path dari SISI KIRI halaman belajar. */
export default function LearningPathDrawer({
  open,
  onClose,
  chapters,
  currentChapterId,
  subSteps,
  currentStepIndex,
  onPickStep,
}: {
  open: boolean;
  onClose: () => void;
  chapters: DrawerChapter[];
  currentChapterId: string;
  /** Langkah materi bab yang SEDANG dibuka (bab lain tidak dimuat materinya). */
  subSteps: DrawerSubStep[];
  /** Index langkah aktif; -1 kalau sedang di fase ringkasan/ujian/selesai. */
  currentStepIndex: number;
  onPickStep: (index: number) => void;
}) {
  // Tutup dengan Esc + kunci scroll body selama drawer terbuka.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-900/40"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel kiri */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Learning path"
        className="absolute left-0 top-0 flex h-full w-full max-w-sm flex-col bg-surface shadow-card"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Learning Path
            </p>
            <h2 className="truncate text-sm font-bold text-slate-800">Pilih Materi Pembelajaran</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup learning path"
            className="shrink-0 text-slate-400 transition hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {chapters.map((ch) => {
            const isCurrent = ch.id === currentChapterId;
            const locked = ch.state === "locked";

            const header = (
              <div
                className={`rounded-2xl border px-4 py-3 transition ${
                  isCurrent
                    ? "border-brand-300 bg-brand-50/60"
                    : locked
                      ? "border-slate-100 bg-slate-50"
                      : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      locked ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    Bab {ch.number}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      ch.state === "completed"
                        ? "bg-emerald-50 text-emerald-600"
                        : ch.state === "generate"
                          ? "bg-amber-50 text-amber-600"
                          : locked
                            ? "bg-slate-100 text-slate-400"
                            : "bg-brand-50 text-brand-600"
                    }`}
                  >
                    {ch.state === "completed" ? "✓ " : locked ? "🔒 " : ""}
                    {STATE_LABEL[ch.state]}
                  </span>
                </div>
                <p
                  className={`mt-0.5 truncate text-sm font-semibold ${
                    locked ? "text-slate-400" : "text-slate-800"
                  }`}
                >
                  {ch.title}
                </p>
              </div>
            );

            return (
              <div key={ch.id}>
                {locked ? (
                  <div title="Selesaikan bab sebelumnya dulu">{header}</div>
                ) : isCurrent ? (
                  header
                ) : (
                  <Link href={`/dashboard/learn/${ch.id}`} onClick={onClose} className="block">
                    {header}
                  </Link>
                )}

                {/* Subbab HANYA untuk bab yang sedang dibuka — materi bab lain tidak dimuat
                    ke client (hemat, tidak perlu fetch seluruh materi course). */}
                {isCurrent && subSteps.length > 0 && (
                  <ol className="relative mt-2 space-y-1 pl-6">
                    <span
                      className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200"
                      aria-hidden
                    />
                    {subSteps.map((s, i) => {
                      const active = i === currentStepIndex;
                      const done = currentStepIndex >= 0 && i < currentStepIndex;
                      return (
                        <li key={i} className="relative">
                          <span
                            className={`absolute -left-6 top-2.5 flex h-3 w-3 items-center justify-center rounded-full border-2 ${
                              active
                                ? "border-brand-500 bg-brand-500"
                                : done
                                  ? "border-emerald-400 bg-emerald-400"
                                  : "border-slate-300 bg-surface"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              onPickStep(i);
                              onClose();
                            }}
                            className={`flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-xs transition hover:bg-brand-50/60 ${
                              active ? "font-bold text-slate-800" : "text-slate-500"
                            }`}
                          >
                            <span className="shrink-0 font-mono text-[10px] text-slate-400">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="line-clamp-1 flex-1">{s.title}</span>
                            {active && <span className="shrink-0 text-brand-500">←</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
