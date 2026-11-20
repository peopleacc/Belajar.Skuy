"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ActiveSessionData = {
  id: string;
  type: string;
  created_at: string;
  title: string;
  answeredCount: number;
  totalItems: number;
};

export default function ActiveSessionModal({
  session,
  onClose,
  onAbandonComplete,
}: {
  session: ActiveSessionData | null;
  onClose: () => void;
  onAbandonComplete?: () => void;
}) {
  const router = useRouter();
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);
  const [loadingAbandon, setLoadingAbandon] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;

  const progressPercent = Math.min(
    100,
    Math.round(((session.answeredCount || 0) / Math.max(session.totalItems || 1, 1)) * 100)
  );

  async function handleAbandon() {
    if (!session) return;
    setLoadingAbandon(true);
    setError(null);
    try {
      const res = await fetch("/api/simulation/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "abandon",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal membatalkan sesi.");
      }
      if (onAbandonComplete) {
        onAbandonComplete();
      } else {
        router.refresh();
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat membatalkan sesi.");
    } finally {
      setLoadingAbandon(false);
    }
  }

  function handleResume() {
    router.push(`/simulation/run/${session.id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all sm:p-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-2xl text-amber-500">
            <i className="bi bi-exclamation-triangle-fill" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              Sesi Simulasi Masih Berjalan
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Anda masih memiliki sesi latihan aktif yang belum diselesaikan. Lanjutkan sekarang untuk mengamankan kuota latihan Anda.
            </p>
          </div>
        </div>

        {/* Detail Sesi Aktif */}
        <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {session.type === "presentation" ? "Presentasi" : "Wawancara"}
            </span>
            <span className="text-xs text-slate-400">
              Dimulai: {new Date(session.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
            </span>
          </div>

          <h4 className="mt-2 text-base font-semibold text-slate-800">
            {session.title || "Sesi Simulasi Aktif"}
          </h4>

          {/* Progress Bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Kemajuan Latihan</span>
              <span>
                {session.answeredCount} / {session.totalItems} Bagian ({progressPercent}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-600">
            <i className="bi bi-x-circle me-1" />
            {error}
          </div>
        )}

        {/* Mode Konfirmasi Pembatalan */}
        {confirmingAbandon ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50/70 p-4">
            <div className="flex items-start gap-2.5">
              <i className="bi bi-shield-exclamation text-lg text-rose-600" />
              <div>
                <p className="text-xs font-bold text-rose-700">Peringatan Kuota Hangus</p>
                <p className="mt-1 text-xs text-rose-600">
                  Membatalkan sesi akan mengakhiri latihan tanpa penilaian, dan <strong>1 tiket kuota mingguan</strong> Anda yang sudah terpakai tidak dapat dikembalikan.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmingAbandon(false)}
                disabled={loadingAbandon}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleAbandon}
                disabled={loadingAbandon}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {loadingAbandon ? "Membatalkan..." : "Ya, Batalkan & Hangus Kuota"}
              </button>
            </div>
          </div>
        ) : (
          /* Tombol Aksi Normal */
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmingAbandon(true)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              ❌ Batalkan Sesi Ini
            </button>
            <button
              type="button"
              onClick={handleResume}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600"
            >
              <i className="bi bi-play-circle-fill text-sm" />
              <span>Lanjutkan Simulasi</span>
            </button>
          </div>
        )}

        {/* Close X Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <span className="sr-only">Tutup</span>
          ✕
        </button>
      </div>
    </div>
  );
}

