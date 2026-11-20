import Link from "next/link";
import type { UserQuotaSummary, QuotaBalance } from "@/lib/subscriptions";

const PLAN_NAME_LABEL: Record<string, string> = {
  free: "Paket Gratis (Free)",
  premium: "Paket Premium",
  premium_presentasi: "Paket Presentasi Pro",
  premium_gabungan: "Paket Gabungan",
  pro: "Paket Pro Lengkap",
};

export default function QuotaOverviewCard({
  quota,
  showTitle = true,
}: {
  quota: UserQuotaSummary;
  showTitle?: boolean;
}) {
  const { balances, features, planCode } = quota;

  const items: { balance: QuotaBalance; periodText: string; resetNote: string }[] = [
    {
      balance: balances.presentation,
      periodText: "minggu ini",
      resetNote: "Direset setiap Senin pukul 07:00 WIB",
    },
    {
      balance: balances.interview,
      periodText: "minggu ini",
      resetNote: "Direset setiap Senin pukul 07:00 WIB",
    },
    {
      balance: balances.modules,
      periodText: "hari ini",
      resetNote: "Direset setiap tengah malam (00:00 WIB)",
    },
    {
      balance: balances.quiz,
      periodText: "hari ini",
      resetNote: "Direset setiap tengah malam (00:00 WIB)",
    },
  ];

  const planLabel = PLAN_NAME_LABEL[planCode] ?? `Paket ${planCode}`;
  const isFree = planCode === "free";

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all sm:p-7">
      {/* ── Header ── */}
      {showTitle && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <i className="bi bi-speedometer2 text-xl" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Penggunaan Kuota Akun
              </h3>
              <p className="text-xs text-slate-500">
                Pantau sisa jatah latihan simulasi dan pembuatan modul AI Anda.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {planLabel}
            </span>
            {isFree && (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1 rounded-xl bg-brand-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-600"
              >
                <span>Upgrade</span>
                <i className="bi bi-arrow-right text-[11px]" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── 4 Quota Grid ── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map(({ balance, periodText, resetNote }) => {
          const limit = balance.limit;
          const used = balance.used;
          const remaining = balance.remaining;
          const isUnlimited = limit === null;

          let percent = 0;
          if (isUnlimited) {
            percent = 100;
          } else if (limit > 0) {
            percent = Math.min(100, Math.round(((remaining ?? 0) / limit) * 100));
          }

          const barColor =
            percent === 0
              ? "bg-rose-500"
              : percent <= 25
              ? "bg-amber-500"
              : "bg-emerald-500";

          return (
            <div
              key={balance.key}
              className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:bg-slate-50"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className={`bi ${balance.icon} text-brand-500 text-sm`} />
                    <span className="text-xs font-bold text-slate-700">
                      {balance.label}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {used} / {isUnlimited ? "∞" : limit} {balance.unit}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {isUnlimited
                        ? "Tanpa Batas Kuota"
                        : remaining === 0
                        ? "Kuota Habis"
                        : `Sisa ${remaining} ${balance.unit} ${periodText}`}
                    </span>
                    {!isUnlimited && (
                      <span className="text-[11px] text-slate-400">
                        {percent}%
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[10px] text-slate-400">
                <i className="bi bi-clock-history me-1" />
                {resetNote}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Feature Pills ── */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/40 px-4 py-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium">
            <i
              className={`bi ${
                features.voicePractice ? "bi-check-circle-fill text-emerald-500" : "bi-lock-fill text-slate-400"
              }`}
            />
            <span>Latihan Suara: <strong>{features.voicePractice ? "Aktif" : "Terkunci"}</strong></span>
          </span>

          <span className="flex items-center gap-1.5 font-medium">
            <i
              className={`bi ${
                features.cameraSkeleton ? "bi-check-circle-fill text-emerald-500" : "bi-lock-fill text-slate-400"
              }`}
            />
            <span>Kerangka Kamera AI: <strong>{features.cameraSkeleton ? "Aktif" : "Terkunci"}</strong></span>
          </span>
        </div>

        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline"
        >
          <span>Lihat Rincian Paket</span>
          <i className="bi bi-arrow-right text-[11px]" />
        </Link>
      </div>
    </div>
  );
}

