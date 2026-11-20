"use client";

import Link from "next/link";

export type QuotaInfo = {
  key?: string;
  limit?: number;
  used?: number;
  resetAt?: string;
};

export type QuotaModalState = {
  isOpen: boolean;
  message?: string;
  title?: string;
  featureName?: string;
  targetPlan?: string;
  quota?: QuotaInfo | null;
};

/**
 * Utility untuk mendeteksi apakah respons API dari service merupakan error kuota habis (429)
 * atau fitur terkunci paket (403).
 */
export function isQuotaError(status: number, data?: any): boolean {
  if (status === 429 || status === 403) return true;
  const message = typeof data === "string" ? data : data?.error ?? "";
  if (!message || typeof message !== "string") return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("kuota") ||
    lower.includes("batas") ||
    lower.includes("upgrade paket") ||
    lower.includes("paketmu belum termasuk") ||
    lower.includes("tercapai")
  );
}

interface QuotaExceededModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  featureName?: string;
  targetPlan?: string; // mis. 'premium' | 'premium_presentasi' | 'premium_gabungan' | 'pro'
  quota?: QuotaInfo | null;
  state?: QuotaModalState;
}

/**
 * Komponen modal terpusat saat kuota habis atau fitur terkunci pada paket gratis.
 * Menampilkan pesan informatif, keuntungan upgrade, dan tombol aksi menuju halaman harga (/pricing).
 * 100% menggunakan Bootstrap Icons.
 */
export default function QuotaExceededModal({
  isOpen: propIsOpen,
  onClose,
  title: propTitle,
  message: propMessage,
  featureName: propFeatureName,
  targetPlan: propTargetPlan,
  quota: propQuota,
  state,
}: QuotaExceededModalProps) {
  const isOpen = state ? state.isOpen : Boolean(propIsOpen);
  const title = state?.title ?? propTitle;
  const message = state?.message ?? propMessage;
  const featureName = state?.featureName ?? propFeatureName;
  const targetPlan = state?.targetPlan ?? propTargetPlan ?? "premium_gabungan";
  const quota = state?.quota ?? propQuota;

  if (!isOpen) return null;

  const defaultTitle = featureName
    ? `Batas Kuota ${featureName} Tercapai`
    : "Batas Kuota Penggunaan Tercapai";

  const defaultMessage =
    message ||
    "Jatah penggunaan untuk paket akunmu telah habis. Tingkatkan paketmu sekarang untuk mendapatkan kuota ekstra dan akses fitur bertenaga AI tanpa hambatan.";

  const pricingUrl = targetPlan ? `/pricing?plan=${targetPlan}` : "/pricing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 sm:p-6 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100 text-left">
        {/* Header Modal */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 mb-2">
                <i className="bi bi-exclamation-octagon-fill text-amber-600"></i>
                <span>Batas Kuota Akun</span>
              </span>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                {title ?? defaultTitle}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
              aria-label="Tutup modal"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        {/* Isi Modal */}
        <div className="p-6 space-y-4">
          {/* Pesan Keterangan Kuota */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 text-xs text-amber-900 leading-relaxed flex items-start gap-3">
            <i className="bi bi-info-circle-fill text-base text-amber-600 shrink-0 mt-0.5"></i>
            <div>
              <p className="font-medium">{defaultMessage}</p>
              {quota?.resetAt && (
                <p className="mt-2 text-[11px] text-amber-700 flex items-center gap-1.5">
                  <i className="bi bi-clock-history"></i>
                  <span>
                    Pulih otomatis pada:{" "}
                    <strong>{new Date(quota.resetAt).toLocaleString("id-ID")}</strong>
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Keuntungan Upgrade */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Keuntungan Upgrade Paket:
            </p>
            <div className="rounded-xl border border-brand-100 bg-brand-50/30 p-3.5 space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <i className="bi bi-check-circle-fill text-brand-600 text-sm shrink-0 mt-0.5"></i>
                <span>Generate modul course dan kurikulum hingga tanpa batas</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <i className="bi bi-check-circle-fill text-brand-600 text-sm shrink-0 mt-0.5"></i>
                <span>Sesi latihan simulasi presentasi slide & wawancara kerja penuh</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <i className="bi bi-check-circle-fill text-brand-600 text-sm shrink-0 mt-0.5"></i>
                <span>Evaluasi audio suara instan dan kecepatan generasi prioritas</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Tombol Aksi */}
        <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Nanti Saja
          </button>

          <Link
            href={pricingUrl}
            className="w-full sm:w-auto rounded-xl bg-brand-500 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Pilih Paket & Upgrade</span>
            <i className="bi bi-stars"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Komponen Banner Alert Kuota Inline (opsional dipasang di bawah form atau tombol)
 */
export function QuotaAlertBanner({
  message,
  onUpgradeClick,
}: {
  message: string;
  onUpgradeClick?: () => void;
}) {
  return (
    <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
      <div className="flex items-start gap-2.5">
        <i className="bi bi-exclamation-triangle-fill text-amber-600 text-sm shrink-0 mt-0.5"></i>
        <span>{message}</span>
      </div>
      <Link
        href="/pricing"
        onClick={onUpgradeClick}
        className="shrink-0 font-bold text-brand-700 hover:text-brand-800 hover:underline flex items-center gap-1"
      >
        <span>Upgrade</span>
        <i className="bi bi-arrow-right"></i>
      </Link>
    </div>
  );
}
