import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import { formatPrice, type Plan } from "@/lib/plans";

/**
 * Lima kartu paket (Fitur EC), dipakai di landing (/) dan halaman harga (/pricing).
 * Rounding + shadow SAMA PERSIS dengan card dashboard ("rounded-sm ... shadow-card").
 *
 * Fitur CB — ANGKA (harga & batas) datang dari database lewat `plans`, sedangkan
 * TEKS (nama paket, daftar fitur, tombol) tetap dari `i18n.ts` supaya bisa
 * diterjemahkan. Angka dan teks dipadankan lewat urutan `sort_order`.
 *
 * `currentIndex` = indeks paket yang sedang dipakai user (null kalau belum login).
 * Kartu itu ditandai dan tombolnya dimatikan — mencegah user membeli paket yang
 * sudah dia miliki.
 *
 * Popular = index 3 (Premium Gabungan — "value pick" antara Premium & Pro).
 *
 * Layout: 3 kartu baris atas + 2 kartu baris bawah (di-center).
 */
export default function PricingPlans({
  t,
  plans,
  currentIndex = null,
}: {
  t: Dict;
  plans: Plan[];
  currentIndex?: number | null;
}) {
  function PlanCard({
    p,
    i,
  }: {
    p: (typeof t.pricing.plans)[0];
    i: number;
  }) {
    // Fitur EC: popular = index 3 (Premium Gabungan, "value pick" di 5 paket)
    const popular = i === 3;
    const isCurrent = i === currentIndex;
    const harga = plans[i];

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
              {harga ? formatPrice(harga.effectiveAmount, harga.currency) : p.price}
            </span>
            {/* Harga normal dicoret — tanpa ini, diskon tak terasa sebagai diskon */}
            {harga?.discounted && (
              <span
                className={`text-base line-through ${
                  popular ? "opacity-60" : "text-slate-400"
                }`}
              >
                {formatPrice(harga.amount, harga.currency)}
              </span>
            )}
            <span className={popular ? "opacity-70" : "text-slate-500"}>
              {t.pricing.period}
            </span>
          </div>

          {harga?.discounted && harga.discountLabel && (
            <span
              className={`mt-3 inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                popular ? "bg-white/20" : "bg-brand-500/10 text-brand-500"
              }`}
            >
              {harga.discountLabel}
            </span>
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

        {isCurrent ? (
          <span
            aria-disabled="true"
            className={`cursor-default rounded-xl py-3.5 text-center text-sm font-semibold ${
              popular ? "bg-white/20 text-white" : "bg-surface-2 text-slate-500"
            }`}
          >
            {t.pricing.currentCta}
          </span>
        ) : (
          <Link
            href="/register"
            className={`rounded-xl py-3.5 text-center text-sm font-semibold transition ${
              popular
                ? "bg-white text-brand-500 hover:opacity-90"
                : "border border-brand-500 text-brand-500 hover:bg-brand-500 hover:text-white"
            }`}
          >
            {p.cta}
          </Link>
        )}
      </div>
    );
  }

  const topPlans = t.pricing.plans.slice(0, 3);
  const bottomPlans = t.pricing.plans.slice(3);

  return (
    <div className="space-y-4">
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
