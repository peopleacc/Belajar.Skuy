"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";

type CancelPlanModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  t: Dict;
};

/**
 * Modal dialog konfirmasi peringatan pembatalan paket langganan.
 *
 * Menampilkan rincian dampak pembatalan (kehilangan akses fitur pro/simulasi,
 * kuota kembali ke Free, dan sisa hari yang hangus).
 */
export default function CancelPlanModal({
  isOpen,
  onClose,
  onSuccess,
  t,
}: CancelPlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const m = t.billing.modal;

  async function handleConfirmCancel() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/payment/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? m.errorMsg);
        return;
      }

      // Berhasil membatalkan paket
      onSuccess();
    } catch {
      setError(m.errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
    >
      {/* Backdrop dengan blur */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={!loading ? onClose : undefined}
      />

      {/* Konten Modal */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all sm:p-8 dark:bg-ink-800">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-2xl text-rose-500">
            <i className="bi bi-exclamation-triangle-fill"></i>
          </div>

          <div className="flex-1">
            <h3
              id="cancel-modal-title"
              className="text-xl font-bold text-slate-800 dark:text-light"
            >
              {m.title}
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {m.desc}
            </p>
          </div>
        </div>

        {/* Poin-poin peringatan */}
        <div className="mt-5 space-y-3 rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-xs text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-200">
          <div className="flex items-start gap-2.5">
            <i className="bi bi-x-circle-fill shrink-0 text-rose-500 mt-0.5"></i>
            <span>{m.point1}</span>
          </div>
          <div className="flex items-start gap-2.5">
            <i className="bi bi-x-circle-fill shrink-0 text-rose-500 mt-0.5"></i>
            <span>{m.point2}</span>
          </div>
          <div className="flex items-start gap-2.5">
            <i className="bi bi-x-circle-fill shrink-0 text-rose-500 mt-0.5"></i>
            <span>{m.point3}</span>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-100 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-surface-2 disabled:opacity-50 dark:text-light"
          >
            {m.cancelBtn}
          </button>

          <button
            type="button"
            onClick={handleConfirmCancel}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
          >
            {loading && (
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
            {loading ? m.processing : m.confirmBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
