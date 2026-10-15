"use client";

export type BillingCycle = 1 | 6 | 12;

interface BillingCycleToggleProps {
  activeCycle: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  labels?: {
    monthly?: string;
    semiAnnual?: string;
    annual?: string;
    save20?: string;
    save30?: string;
  };
}

export default function BillingCycleToggle({
  activeCycle,
  onChange,
  labels,
}: BillingCycleToggleProps) {
  const lMonthly = labels?.monthly ?? "1 Bulan";
  const lSemiAnnual = labels?.semiAnnual ?? "6 Bulan";
  const lAnnual = labels?.annual ?? "1 Tahun";
  const lSave20 = labels?.save20 ?? "Hemat 20%";
  const lSave30 = labels?.save30 ?? "Hemat 30%";

  const options: { cycle: BillingCycle; label: string; badge?: string; badgeColor?: string }[] = [
    {
      cycle: 1,
      label: lMonthly,
    },
    {
      cycle: 6,
      label: lSemiAnnual,
      badge: lSave20,
      badgeColor: "bg-emerald-500 text-white",
    },
    {
      cycle: 12,
      label: lAnnual,
      badge: lSave30,
      badgeColor: "bg-amber-500 text-white font-bold",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-2 mb-8">
      <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {options.map((opt) => {
          const isActive = activeCycle === opt.cycle;
          return (
            <button
              key={opt.cycle}
              type="button"
              onClick={() => onChange(opt.cycle)}
              className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 sm:text-sm ${
                isActive
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <span>{opt.label}</span>
              {opt.badge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                    isActive
                      ? "bg-white/20 text-white"
                      : `${opt.badgeColor} shadow-xs`
                  }`}
                >
                  {opt.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
