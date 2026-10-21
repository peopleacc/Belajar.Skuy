"use client";

import type { CadenceSnapshot } from "@/lib/speechCadence";

interface LiveCadenceHUDProps {
  cadence: CadenceSnapshot | null;
  compact?: boolean;
}

/**
 * LiveCadenceHUD — Widget HUD Real-Time Kecepatan Berbicara (WPS & WPM).
 * Ditempatkan di atas/samping video presenter saat sesi simulasi berjalan.
 */
export function LiveCadenceHUD({ cadence, compact = false }: LiveCadenceHUDProps) {
  if (!cadence) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-400 backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span>Menghubungkan sensor laju bicara…</span>
      </div>
    );
  }

  const { liveWps, liveWpm, label, coachingTip, category } = cadence;

  const badgeColor =
    category === "ideal"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-300"
      : category === "fast"
      ? "bg-amber-500/10 text-amber-600 border-amber-300"
      : category === "slow"
      ? "bg-sky-500/10 text-sky-600 border-sky-300"
      : category === "rush"
      ? "bg-rose-500/10 text-rose-600 border-rose-300"
      : "bg-slate-100 text-slate-500 border-slate-200";

  const dotColor =
    category === "ideal"
      ? "bg-emerald-500 animate-pulse"
      : category === "fast"
      ? "bg-amber-500"
      : category === "slow"
      ? "bg-sky-500"
      : category === "rush"
      ? "bg-rose-500 animate-ping"
      : "bg-slate-400";

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1 shadow-sm backdrop-blur">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-xs font-bold text-slate-800">{liveWps} kata/dtk</span>
        <span className="text-[11px] text-slate-400">({liveWpm} WPM)</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeColor}`}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white/95 p-3.5 shadow-sm backdrop-blur-md transition">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            ⚡
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Live Cadence
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-extrabold text-slate-800">
                {liveWps}{" "}
                <span className="text-xs font-normal text-slate-500">kata/detik</span>
              </span>
              <span className="text-xs text-slate-400">({liveWpm} WPM)</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${badgeColor}`}
          >
            <span className={`h-2 w-2 rounded-full ${dotColor}`} />
            {label}
          </span>
        </div>
      </div>

      {/* Bar Kecepatan Mini */}
      <div className="mt-2.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all duration-300 ${
              category === "ideal"
                ? "bg-emerald-500"
                : category === "fast"
                ? "bg-amber-500"
                : category === "slow"
                ? "bg-sky-500"
                : category === "rush"
                ? "bg-rose-500"
                : "bg-slate-300"
            }`}
            style={{ width: `${Math.min(100, Math.max(8, (liveWps / 4.0) * 100))}%` }}
          />
        </div>
      </div>

      {coachingTip && (
        <p className="mt-2 text-[11px] leading-tight text-slate-500 italic">
          💡 {coachingTip}
        </p>
      )}
    </div>
  );
}
