"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dict, Lang } from "@/lib/i18n";
import type { SubscriptionDetails } from "@/lib/subscriptions";
import CancelPlanModal from "@/components/CancelPlanModal";
import SimpleInvoiceModal from "@/components/SimpleInvoiceModal";

type Props = {
  initialDetails: SubscriptionDetails;
  t: Dict;
  lang: Lang;
  userName?: string;
  userEmail?: string;
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
  userName = "Pengguna belajar.skuy",
  userEmail = "-",
}: Props) {
  const router = useRouter();
  const [details, setDetails] = useState<SubscriptionDetails>(initialDetails);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);
  const [cancelingOrder, setCancelingOrder] = useState(false);
  const [orderCancelError, setOrderCancelError] = useState<string | null>(null);

  useEffect(() => {
    setDetails(initialDetails);
  }, [initialDetails]);

  const hasInvoice =
    (details.latestOrder && details.latestOrder.status !== "pending") ||
    details.isPaidActive;

  const b = t.billing;
  const planLabel =
    details.status === "canceled"
      ? (lang === "id" ? "Gratis (Dibatalkan)" : "Free (Canceled)")
      : (PLAN_NAME_MAP[details.planCode]?.[lang] ?? details.planCode.toUpperCase());

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

  async function handleCancelPendingOrder(orderId: string) {
    const confirmMsg =
      lang === "id"
        ? "Yakin ingin membatalkan tagihan pembayaran ini?"
        : "Are you sure you want to cancel this pending invoice?";
    if (!window.confirm(confirmMsg)) return;

    setCancelingOrder(true);
    setOrderCancelError(null);
    try {
      const res = await fetch("/api/payment/cancel-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOrderCancelError(
          data?.error || (lang === "id" ? "Gagal membatalkan tagihan." : "Failed to cancel invoice.")
        );
        return;
      }
      setDetails((prev) => ({
        ...prev,
        latestOrder: prev.latestOrder ? { ...prev.latestOrder, status: "canceled" } : null,
      }));
      router.refresh();
    } catch {
      setOrderCancelError(lang === "id" ? "Terjadi gangguan koneksi." : "Connection error.");
    } finally {
      setCancelingOrder(false);
    }
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
    <div className="rounded-sm bg-white p-6 shadow-card md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-2xl text-brand-500">
            <i className="bi bi-credit-card-2-front-fill"></i>
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-800">
              {b.title}
            </h2>
            <p className="text-xs text-slate-500">
              {b.subtitle}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {details.isPaidActive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {b.activeBadge} ({planLabel})
            </span>
          ) : details.latestOrder?.status === "pending" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-700">
              <i className="bi bi-hourglass-split text-amber-500" />
              {b.pendingBadge}
            </span>
          ) : details.status === "canceled" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1 text-xs font-bold text-rose-700">
              <i className="bi bi-x-circle-fill text-rose-500" />
              {b.canceledBadge}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1 text-xs font-bold text-slate-700">
              {b.freeBadge}
            </span>
          )}
        </div>
      </div>

      {/* Banner Tagihan Pending (Menunggu Pembayaran) */}
      {details.latestOrder && details.latestOrder.status === "pending" && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-xl text-amber-600">
                <i className="bi bi-hourglass-split"></i>
              </span>
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  {b.pendingCardTitle}
                </h4>
                <p className="mt-0.5 text-xs text-amber-700">
                  {b.pendingCardDesc}
                </p>
                <div className="mt-2 flex flex-wrap gap-4 text-xs font-medium text-amber-800">
                  <span>
                    {b.orderId}: <strong className="font-mono">{details.latestOrder.id}</strong>
                  </span>
                  <span>
                    {b.amount}: <strong>{formatAmount(details.latestOrder.amount, details.latestOrder.currency)}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleCancelPendingOrder(details.latestOrder!.id)}
                disabled={cancelingOrder}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:opacity-50"
              >
                <i className="bi bi-x-circle"></i>
                <span>
                  {cancelingOrder
                    ? lang === "id"
                      ? "Membatalkan..."
                      : "Canceling..."
                    : lang === "id"
                    ? "Batalkan Tagihan"
                    : "Cancel Invoice"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleResumePayment(details.latestOrder!)}
                disabled={cancelingOrder}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
              >
                <i className="bi bi-wallet2"></i>
                {b.continuePaymentBtn}
              </button>
            </div>
          </div>

          {orderCancelError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
              <i className="bi bi-exclamation-triangle-fill text-rose-500"></i>
              <span>{orderCancelError}</span>
            </div>
          )}
        </div>
      )}

      {cancelSuccessMsg && (
        <div className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
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
          <p className="text-lg font-extrabold text-slate-800">
            {planLabel}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            {b.activeUntil}
          </p>
          <p className="text-base font-semibold text-slate-700">
            {details.isPaidActive
              ? formatExpiryDate(details.currentPeriodEnd, lang)
              : b.unlimited}
          </p>
        </div>
      </div>

      {/* Rincian Transaksi Terakhir */}
      {details.latestOrder && details.latestOrder.status !== "pending" && (
        <div className="mt-6 rounded-xl border border-border bg-surface-2/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              {b.lastPayment}
            </p>
            <button
              type="button"
              onClick={() => setShowInvoiceModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline"
            >
              <i className="bi bi-receipt-cutoff"></i>
              <span>Lihat Invoice</span>
            </button>
          </div>
          <div className="grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <span className="text-slate-400">{b.orderId}:</span>
              <p className="mt-0.5 font-mono font-semibold text-slate-700">
                {details.latestOrder.id}
              </p>
            </div>
            <div>
              <span className="text-slate-400">{b.amount}:</span>
              <p className="mt-0.5 font-semibold text-slate-800">
                {formatAmount(
                  details.latestOrder.amount,
                  details.latestOrder.currency
                )}
              </p>
            </div>
            <div>
              <span className="text-slate-400">{b.date}:</span>
              <p className="mt-0.5 font-semibold text-slate-700">
                {formatExpiryDate(details.latestOrder.createdAt, lang)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tombol Aksi */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-600"
          >
            <i className="bi bi-arrow-up-right-circle-fill"></i>
            {b.upgradeBtn}
          </Link>

          {hasInvoice && (
            <button
              type="button"
              onClick={() => setShowInvoiceModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-brand-600"
            >
              <i className="bi bi-receipt-cutoff text-brand-500"></i>
              <span>Lihat / Cetak Invoice</span>
            </button>
          )}
        </div>

        {details.isPaidActive && (
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
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

      {/* Modal Bukti Pembayaran / Invoice Sederhana (Task 3D-IV) */}
      {hasInvoice && (
        <SimpleInvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          orderId={details.latestOrder?.id || details.providerRef || ("SUB-" + details.planCode.toUpperCase())}
          planName={planLabel}
          amount={details.latestOrder?.amount || (details.planCode === "pro" ? 99000 : 49000)}
          currency={details.latestOrder?.currency || "IDR"}
          paymentDate={details.latestOrder?.createdAt || details.updatedAt || new Date().toISOString()}
          periodEnd={details.currentPeriodEnd}
          customerName={userName}
          customerEmail={userEmail}
          status={details.latestOrder?.status || "paid"}
        />
      )}
    </div>
  );
}
