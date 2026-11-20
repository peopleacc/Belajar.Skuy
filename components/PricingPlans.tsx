"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import type { Plan } from "@/lib/plans";
import { formatPrice } from "@/lib/format";
import PaymentButton from "@/components/PaymentButton";
import BillingCycleToggle, { type BillingCycle } from "@/components/BillingCycleToggle";

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
      if (isFree) return "Tanpa kartu kredit";
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
        className={`relative flex flex-col justify-between rounded-3xl p-5 sm:p-6 transition-all duration-300 border ${
          popular
            ? "bg-[#283157] text-white border-[#283157] shadow-xl scale-[1.02] z-10"
            : "bg-white text-slate-800 border-slate-200/80 shadow-sm hover:border-slate-300"
        } ${isCurrent ? "ring-2 ring-[#283157]" : ""}`}
      >
        {/* Top Badges */}
        {isCurrent ? (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-md flex items-center gap-1">
            <i className="bi bi-check-circle-fill"></i>
            {t.pricing.current}
          </span>
        ) : (
          popular && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-900 shadow-md flex items-center gap-1">
              <i className="bi bi-star-fill text-[9px]"></i>
              {t.pricing.popular}
            </span>
          )
        )}

        {/* Card Header & Price */}
        <div>
          <span
            className={`text-[11px] font-bold uppercase tracking-wider ${
              popular ? "text-indigo-200" : "text-slate-400"
            }`}
          >
            {p.tier}
          </span>
          <h3 className="mt-1 text-lg font-extrabold tracking-tight">{p.name}</h3>

          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black tracking-tight">
              {isFree
                ? p.price
                : formatPrice(cycleDetail.monthlyEquivalent, harga.currency)}
            </span>

            {/* Crossed-out original price during 6-mo or 1-yr discounts */}
            {!isFree && cycleDetail.discounted && (
              <span
                className={`text-xs line-through ${
                  popular ? "text-indigo-200/70" : "text-slate-400"
                }`}
              >
                {formatPrice(
                  Math.round(cycleDetail.amount / activeCycle),
                  harga.currency
                )}
              </span>
            )}

            <span
              className={`text-xs font-semibold ${
                popular ? "text-indigo-200" : "text-slate-400"
              }`}
            >
              {t.pricing.period}
            </span>
          </div>

          {/* Billing Note & Discount Pill */}
          <div className="mt-2 space-y-1">
            <p
              className={`text-xs font-medium ${
                popular ? "text-indigo-100/80" : "text-slate-500"
              }`}
            >
              {billingSummary}
            </p>

            {!isFree && cycleDetail.discounted && cycleDetail.discountLabel && (
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  popular
                    ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {cycleDetail.discountLabel}
              </span>
            )}
          </div>

          <div
            className={`my-4 border-t ${
              popular ? "border-white/15" : "border-slate-100"
            }`}
          />

          {/* Feature List */}
          <ul className="space-y-2.5">
            {p.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-xs leading-relaxed">
                <i
                  className={`bi bi-check-circle-fill text-sm shrink-0 mt-0.5 ${
                    popular ? "text-emerald-300" : "text-emerald-500"
                  }`}
                ></i>
                <span className={popular ? "text-white/95" : "text-slate-700 font-medium"}>
                  {f}
                </span>
              </li>
            ))}
          </ul>

          {/* Excluded Features Collapsible Details */}
          {p.disabled && p.disabled.length > 0 && (
            <details className="mt-4 pt-3 border-t border-slate-100 text-xs group">
              <summary className="cursor-pointer font-semibold text-slate-400 hover:text-slate-600 flex items-center justify-between list-none">
                <span>Tidak termasuk ({p.disabled.length})</span>
                <i className="bi bi-chevron-down text-[10px] transition-transform group-open:rotate-180"></i>
              </summary>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
                {p.disabled.map((df) => (
                  <li key={df} className="flex items-center gap-1.5">
                    <i className="bi bi-dash-circle text-slate-300"></i>
                    <span>{df}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-6 mt-auto">
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
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Billing Cycle Toggle */}
      <BillingCycleToggle
        activeCycle={activeCycle}
        onChange={setActiveCycle}
        labels={cycleLabels}
      />

      {/* 5 Plan Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-stretch">
        {t.pricing.plans.map((p, i) => (
          <PlanCard key={p.name} p={p} i={i} />
        ))}
      </div>
    </div>
  );
}
