"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dict, Lang } from "@/lib/i18n";
import type { SubscriptionDetails } from "@/lib/subscriptions";
import CancelPlanModal from "@/components/CancelPlanModal";

type Props = {
  initialDetails: SubscriptionDetails;
  t: Dict;
  lang: Lang;
};

// Nama paket ramah pengguna berdasarkan kamus
const PLAN_NAME_MAP: Record<string, { id: string; en: string }> = {
  free: { id: "Gratis", en: "Free" },
  premium: { id: "Premium", en: "Premium" },
  premium_presentasi: { id: "Premium Presentasi", en: "Premium Presentation" },
  premium_gabungan: { id: "Premium Gabungan", en: "Premium Combo" },
  pro: { id: "Pro", en: "Pro" },
};

function formatExpiryDate(dateStr: string | null, lang: Lang): string {
  if (!dateStr) return lang === "id" ? "Tanpa batas waktu" : "No expiration";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function formatAmount(amount: number, currency: string): string {
  if (currency === "IDR") {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }
  return `$${amount}`;
}

export default function SubscriptionDetailsCard({
  initialDetails,
  t,
  lang,
}: Props) {
  const router = useRouter();
  const [details, setDetails] = useState<SubscriptionDetails>(initialDetails);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);

  const b = t.billing;
  const planLabel =
    PLAN_NAME_MAP[details.planCode]?.[lang] ?? details.planCode.toUpperCase();

  function handleCancelSuccess() {
    setShowCancelModal(false);
    setDetails((prev) => ({
      ...prev,
      planCode: "free",
      status: "canceled",
      isPaidActive: false,
      currentPeriodEnd: null,
    }));
    setCancelSuccessMsg(b.modal.successMsg);
    router.refresh();
  }

  function handleResumePayment(order: NonNullable<SubscriptionDetails["latestOrder"]>) {
    if (order.snapToken && typeof window !== "undefined" && window.snap?.pay) {
      window.snap.pay(order.snapToken, {
        onSuccess: () => {
          window.location.href = "/pricing?payment=success";
        },
        onPending: () => {
          window.location.href = "/pricing?payment=pending";
        },
        onError: () => {
          window.location.href = "/pricing?payment=error";
        },
      });
    } else if (order.snapRedirectUrl) {
      window.location.href = order.snapRedirectUrl;
    } else {
      window.location.href = "/pricing";
    }
  }

  return (
    <div className="rounded-sm bg-white p-6 shadow-card md:p-8 dark:bg-ink-800">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-2xl text-brand-500">
            <i className="bi bi-credit-card-2-front-fill"></i>
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-light">
              {b.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {b.subtitle}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {details.isPaidActive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {b.activeBadge} ({planLabel})
            </span>
          ) : details.latestOrder?.status === "pending" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <i className="bi bi-hourglass-split text-amber-500" />
              {b.pendingBadge}
            </span>
          ) : details.status === "canceled" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1 text-xs font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              <i className="bi bi-x-circle-fill text-rose-500" />
              {b.canceledBadge}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {b.freeBadge}
            </span>
          )}
        </div>
      </div>

      {/* Banner Tagihan Pending (Menunggu Pembayaran) */}
      {details.latestOrder && details.latestOrder.status === "pending" && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-xl text-amber-600 dark:text-amber-400">
                <i className="bi bi-hourglass-split"></i>
              </span>
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {b.pendingCardTitle}
                </h4>
                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                  {b.pendingCardDesc}
                </p>
                <div className="mt-2 flex flex-wrap gap-4 text-xs font-medium text-amber-800 dark:text-amber-300">
                  <span>
                    {b.orderId}: <strong className="font-mono">{details.latestOrder.id}</strong>
                  </span>
                  <span>
                    {b.amount}: <strong>{formatAmount(details.latestOrder.amount, details.latestOrder.currency)}</strong>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleResumePayment(details.latestOrder!)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700"
            >
              <i className="bi bi-wallet2"></i>
              {b.continuePaymentBtn}
            </button>
          </div>
        </div>
      )}

      {cancelSuccessMsg && (
        <div className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <i className="bi bi-check-circle-fill text-base text-emerald-500" />
          <span>{cancelSuccessMsg}</span>
        </div>
      )}

      {/* Grid Informasi Langganan */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            {b.currentPlan}
          </p>
          <p className="text-lg font-extrabold text-slate-800 dark:text-light">
            {planLabel}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            {b.activeUntil}
          </p>
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
            {details.isPaidActive
              ? formatExpiryDate(details.currentPeriodEnd, lang)
              : b.unlimited}
          </p>
        </div>
      </div>

      {/* Rincian Transaksi Terakhir */}
      {details.latestOrder && details.latestOrder.status !== "pending" && (
        <div className="mt-6 rounded-xl border border-border bg-surface-2/60 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            {b.lastPayment}
          </p>
          <div className="grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <span className="text-slate-400">{b.orderId}:</span>
              <p className="mt-0.5 font-mono font-semibold text-slate-700 dark:text-slate-300">
                {details.latestOrder.id}
              </p>
            </div>
            <div>
              <span className="text-slate-400">{b.amount}:</span>
              <p className="mt-0.5 font-semibold text-slate-800 dark:text-light">
                {formatAmount(
                  details.latestOrder.amount,
                  details.latestOrder.currency
                )}
              </p>
            </div>
            <div>
              <span className="text-slate-400">{b.date}:</span>
              <p className="mt-0.5 font-semibold text-slate-700 dark:text-slate-300">
                {formatExpiryDate(details.latestOrder.createdAt, lang)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tombol Aksi */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-600"
        >
          <i className="bi bi-arrow-up-right-circle-fill"></i>
          {b.upgradeBtn}
        </Link>

        {details.isPaidActive && (
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
          >
            <i className="bi bi-x-octagon-fill"></i>
            {b.cancelBtn}
          </button>
        )}
      </div>

      {/* Modal Konfirmasi Pembatalan */}
      <CancelPlanModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onSuccess={handleCancelSuccess}
        t={t}
      />
    </div>
  );
}
