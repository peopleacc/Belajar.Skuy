"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface RetrySessionData {
  id: string;
  type: string;
  settings?: any;
  context?: any;
}

export default function RetrySimulationButton({
  session,
  variant = "primary",
  label = "Ulangi Simulasi Ini",
  className = "",
}: {
  session: RetrySessionData;
  variant?: "primary" | "secondary" | "header";
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInterviewKind = session.type === "interview" || session.type === "wawancara";

  async function handleRetry() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const payload: any = {
        type: session.type,
        settings: session.settings ?? { language: "id" },
      };

      if (isInterviewKind) {
        payload.context = {
          ...session.context,
          questions: session.context?.questions ?? [],
          role: session.context?.role ?? session.context?.title ?? "Interview",
          level: session.context?.level ?? "menengah",
          jobDesc: session.context?.jobDesc ?? session.context?.promptText ?? "",
          isRetry: true,
          parentSessionId: session.id,
        };
      } else {
        payload.slides = session.context?.slides ?? [];
        payload.totalSlides =
          session.context?.totalSlides ??
          (Array.isArray(session.context?.slides) ? session.context.slides.length : 1);
        payload.context = {
          ...session.context,
          isRetry: true,
          parentSessionId: session.id,
        };
      }

      const res = await fetch("/api/simulation/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Gagal memulai latihan ulang. Coba lagi.");
        return;
      }

      router.push(`/simulation/run/${data.sessionId}`);
    } catch {
      setError("Tidak bisa terhubung ke server. Periksa koneksi Anda.");
    } finally {
      setBusy(false);
    }
  }

  const baseCls =
    "inline-flex items-center justify-center gap-2 font-semibold transition active:scale-95 disabled:opacity-60 cursor-pointer";

  let variantCls =
    "rounded-xl bg-[#283157] hover:bg-[#1f2644] px-4 py-2.5 text-xs text-white shadow-xs font-bold";

  if (variant === "secondary") {
    variantCls =
      "rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs text-slate-700 shadow-2xs";
  } else if (variant === "header") {
    variantCls =
      "rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-xs text-[#283157] font-bold shadow-2xs";
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleRetry}
        disabled={busy}
        className={`${baseCls} ${variantCls} ${className}`}
        title="Ulangi simulasi dengan materi/soal yang sama tanpa membuang kuota baru"
      >
        {busy ? (
          <>
            <i className="bi bi-arrow-repeat animate-spin"></i>
            <span>Menyiapkan Latihan Ulang…</span>
          </>
        ) : (
          <>
            <i className="bi bi-arrow-repeat"></i>
            <span>{label}</span>
          </>
        )}
      </button>
      {error && <p className="text-[11px] text-rose-500 font-medium">{error}</p>}
    </div>
  );
}
