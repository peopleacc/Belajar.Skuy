"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RescoreButton from "./RescoreButton";

interface AutoReportPollerProps {
  sessionId: string;
  isFinished: boolean;
}

export default function AutoReportPoller({
  sessionId,
  isFinished,
}: AutoReportPollerProps) {
  const router = useRouter();
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    // EV01: Trigger score sekali saja jika sesi telah selesai dan belum dipicu
    if (isFinished && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      fetch("/api/simulation/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        signal,
      }).catch(() => {});
    }

    // Polling setiap 2 detik hingga laporan benar-benar tersedia di Supabase (EV09)
    const interval = setInterval(async () => {
      setSecondsElapsed((prev) => {
        const next = prev + 2;
        if (next >= 45) {
          setTimedOut(true);
          clearInterval(interval);
        }
        return next;
      });

      try {
        const res = await fetch(`/api/simulation/session?sessionId=${sessionId}`, { signal });
        if (res.ok) {
          const data = await res.json();
          // EV09: Cek hasReport apakah laporan sudah tersimpan di database
          if (data?.hasReport) {
            clearInterval(interval);
            router.refresh();
          }
        }
      } catch {
        /* abaikan kesalahan pembatalan atau jaringan saat polling */
      }
    }, 2000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [sessionId, isFinished, router]);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-8 md:p-12 text-center shadow-card space-y-6 max-w-xl mx-auto">
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 border border-brand-500/20">
        <i className="bi bi-arrow-repeat text-3xl animate-spin" />
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold shadow-sm">
          <i className="bi bi-cpu" />
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-bold tracking-tight text-slate-800">
          Menyusun Evaluasi &amp; Menghitung Skor Sesi
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
          Menganalisis rekaman wicara, tempo bicara (WPM), kata pengisi, dan kesesuaian jawaban Anda secara komprehensif.
        </p>
      </div>

      {/* Skeleton Shimmer Bar */}
      <div className="space-y-2.5 max-w-md mx-auto">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 via-indigo-500 to-brand-600 animate-pulse" />
        </div>
        <div className="flex justify-between items-center text-[11px] font-medium text-slate-400">
          <span>Sinkronisasi metrik wicara...</span>
          <span>{Math.round(secondsElapsed)} detik</span>
        </div>
      </div>

      {timedOut && (
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3 border border-amber-200/80">
            Sinkronisasi membutuhkan waktu lebih lama dari biasanya. Anda dapat memicu perhitungan ulang secara langsung.
          </p>
          <RescoreButton sessionId={sessionId} label="Hitung & Buat Laporan Skor Sekarang" />
        </div>
      )}
    </div>
  );
}
