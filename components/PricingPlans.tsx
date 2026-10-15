"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import type { Plan } from "@/lib/plans";
import { formatPrice } from "@/lib/format";
import PaymentButton from "@/components/PaymentButton";
import BillingCycleToggle, { type BillingCycle } from "@/components/BillingCycleToggle";

/**
 * Lima kartu paket (planning-update-16), dipakai di landing (/) dan halaman harga (/pricing).
 * Dilengkapi dengan tombol geser billing cycle (1 Bulan, 6 Bulan -20%, 1 Tahun -30%).
 *
 * `currentIndex` = indeks paket yang sedang dipakai user (null kalau belum login).
 * Popular = index 3 (Premium Gabungan — "value pick" di 5 paket).
 */
export default function PricingPlans({
  t,
  plans,
  currentIndex = null,
  isLoggedIn = false,
}: {
  t: Dict;
  plans: Plan[];
  currentIndex?: number | null;
  /** Jika true, tombol paket berbayar akan memicu checkout Midtrans. */
  isLoggedIn?: boolean;
}) {
  const [activeCycle, setActiveCycle] = useState<BillingCycle>(1);
  const cycleLabels = (t.pricing as any)?.billingCycles;

  function PlanCard({
    p,
    i,
  }: {
    p: (typeof t.pricing.plans)[0];
    i: number;
  }) {
    // Popular = index 3 (Premium Gabungan)
    const popular = i === 3;
    const isCurrent = i === currentIndex;
    const harga = plans[i];

    // Ambil harga spesifik siklus yang aktif (1, 6, atau 12 bulan)
    const cycleDetail = harga?.durations?.[activeCycle] ?? {
      durationMonths: activeCycle,
      amount: harga?.amount ?? 0,
      effectiveAmount: harga?.effectiveAmount ?? 0,
      monthlyEquivalent: harga?.monthlyEquivalent ?? 0,
      discounted: false,
      discountLabel: null,
    };

    const isFree = (harga?.code ?? "free") === "free";

    // Keterangan total tagihan
    const billingSummary = (() => {
      if (isFree) return null;
      if (activeCycle === 1) {
        return cycleLabels?.billedMonthly ?? "Ditagih bulanan";
      }
      if (activeCycle === 6) {
        return `${cycleLabels?.billedSemiAnnual ?? "Ditagih per 6 bulan"} (${formatPrice(
          cycleDetail.effectiveAmount,
          harga.currency
        )})`;
      }
      return `${cycleLabels?.billedAnnual ?? "Ditagih per tahun"} (${formatPrice(
        cycleDetail.effectiveAmount,
        harga.currency
      )})`;
    })();

    return (
      <div
        className={`relative flex flex-col rounded-sm p-8 shadow-card ${
          popular ? "bg-brand-500 text-white" : "bg-white"
        } ${isCurrent ? "ring-2 ring-brand-500" : ""}`}
      >
        {isCurrent ? (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
            {t.pricing.current}
          </span>
        ) : (
          popular && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-700 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
              {t.pricing.popular}
            </span>
          )
        )}

        <div className="mb-8">
          <span
            className={`text-xs font-bold uppercase tracking-widest ${
              popular ? "opacity-70" : "text-slate-500"
            }`}
          >
            {p.tier}
          </span>
          <h3 className="mt-2 text-2xl font-bold">{p.name}</h3>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight">
              {isFree
                ? p.price
                : formatPrice(cycleDetail.monthlyEquivalent, harga.currency)}
            </span>

            {/* Harga normal dicoret saat diskon 6 bulan / 1 tahun */}
            {!isFree && cycleDetail.discounted && (
              <span
                className={`text-base line-through ${
                  popular ? "opacity-60" : "text-slate-400"
                }`}
              >
                {formatPrice(
                  Math.round(cycleDetail.amount / activeCycle),
                  harga.currency
                )}
              </span>
            )}

            <span className={popular ? "opacity-70" : "text-slate-500"}>
              {t.pricing.period}
            </span>
          </div>

          {/* Keterangan total penagihan dan badge diskon */}
          {!isFree && (
            <div className="mt-2 space-y-1">
              <p
                className={`text-xs font-medium ${
                  popular ? "text-white/80" : "text-slate-500"
                }`}
              >
                {billingSummary}
              </p>

              {cycleDetail.discounted && cycleDetail.discountLabel && (
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                    popular ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  }`}
                >
                  {cycleDetail.discountLabel}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mb-8 flex-1 space-y-4">
          {p.features.map((f) => (
            <div key={f} className="flex items-center gap-3">
              <i
                className={`bi bi-check-circle-fill ${
                  popular ? "text-white/80" : "text-brand-500"
                }`}
              ></i>
              <span className="text-sm">{f}</span>
            </div>
          ))}
          {p.disabled.map((f) => (
            <div key={f} className="flex items-center gap-3 opacity-40">
              <i className="bi bi-x-circle"></i>
              <span className="text-sm line-through">{f}</span>
            </div>
          ))}
        </div>

        <PaymentButton
          planCode={harga?.code ?? "free"}
          planName={p.name}
          isLoggedIn={isLoggedIn}
          isCurrent={isCurrent}
          isPopular={popular}
          ctaText={p.cta}
          currentCtaText={t.pricing.currentCta}
          durationMonths={activeCycle}
        />
      </div>
    );
  }

  const topPlans = t.pricing.plans.slice(0, 3);
  const bottomPlans = t.pricing.plans.slice(3);

  return (
    <div className="space-y-6">
      {/* Tombol Geser Durasi Penagihan (1 Bulan, 6 Bulan, 1 Tahun) */}
      <BillingCycleToggle
        activeCycle={activeCycle}
        onChange={setActiveCycle}
        labels={cycleLabels}
      />

      {/* Baris atas: 3 kartu */}
      <div className="grid items-stretch gap-4 grid-cols-1 sm:grid-cols-3">
        {topPlans.map((p, i) => (
          <PlanCard key={p.name} p={p} i={i} />
        ))}
      </div>

      {/* Baris bawah: 2 kartu di-center */}
      <div className="grid items-stretch gap-4 grid-cols-1 sm:grid-cols-2 sm:w-2/3 mx-auto">
        {bottomPlans.map((p, i) => (
          <PlanCard key={p.name} p={p} i={i + 3} />
        ))}
      </div>
    </div>
  );
}
