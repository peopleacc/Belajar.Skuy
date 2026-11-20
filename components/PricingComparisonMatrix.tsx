"use client";

import { useState } from "react";

export interface ComparisonRow {
  label: string;
  category?: string;
  values: {
    free: string;
    premium: string;
    premium_presentasi: string;
    premium_gabungan: string;
    pro: string;
  };
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: "Modul aktif",
    values: {
      free: "1/hari",
      premium: "3/hari",
      premium_presentasi: "1/hari",
      premium_gabungan: "5/hari",
      pro: "15/hari",
    },
  },
  {
    label: "Bab per modul",
    values: {
      free: "3 bab",
      premium: "Tanpa batas",
      premium_presentasi: "Tanpa batas",
      premium_gabungan: "Tanpa batas",
      pro: "Tanpa batas",
    },
  },
  {
    label: "Generate bab/hari",
    values: {
      free: "6",
      premium: "40",
      premium_presentasi: "10",
      premium_gabungan: "50",
      pro: "100",
    },
  },
  {
    label: "Kuis pilihan ganda & esai",
    values: {
      free: "yes",
      premium: "yes",
      premium_presentasi: "yes",
      premium_gabungan: "yes",
      pro: "yes",
    },
  },
  {
    label: "Penilaian otomatis",
    values: {
      free: "yes",
      premium: "yes",
      premium_presentasi: "yes",
      premium_gabungan: "yes",
      pro: "yes",
    },
  },
  {
    label: "Video referensi terkurasi",
    values: {
      free: "yes",
      premium: "yes",
      premium_presentasi: "yes",
      premium_gabungan: "yes",
      pro: "yes",
    },
  },
  {
    label: "Jurnal & Wikipedia",
    values: {
      free: "yes",
      premium: "yes",
      premium_presentasi: "yes",
      premium_gabungan: "yes",
      pro: "yes",
    },
  },
  {
    label: "Tutor chat AI",
    values: {
      free: "yes",
      premium: "yes",
      premium_presentasi: "yes",
      premium_gabungan: "yes",
      pro: "yes",
    },
  },
  {
    label: "Latihan suara AI",
    values: {
      free: "no",
      premium: "yes",
      premium_presentasi: "yes",
      premium_gabungan: "yes",
      pro: "yes",
    },
  },
  {
    label: "Simulasi presentasi / minggu",
    values: {
      free: "no",
      premium: "no",
      premium_presentasi: "10x",
      premium_gabungan: "15x",
      pro: "40x",
    },
  },
  {
    label: "Simulasi wawancara / minggu",
    values: {
      free: "no",
      premium: "no",
      premium_presentasi: "10x",
      premium_gabungan: "15x",
      pro: "30x",
    },
  },
  {
    label: "Dukungan prioritas 24/7",
    values: {
      free: "no",
      premium: "no",
      premium_presentasi: "no",
      premium_gabungan: "no",
      pro: "yes",
    },
  },
  {
    label: "Akses fitur beta",
    values: {
      free: "no",
      premium: "no",
      premium_presentasi: "yes",
      premium_gabungan: "yes",
      pro: "yes",
    },
  },
];

const PLAN_META: Record<string, { name: string; popular?: boolean }> = {
  free: { name: "Gratis" },
  premium: { name: "Premium" },
  premium_presentasi: { name: "Presentasi" },
  premium_gabungan: { name: "Gabungan", popular: true },
  pro: { name: "Pro" },
};

function CellRenderer({ value }: { value: string }) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center justify-center text-emerald-500 font-bold">
        <i className="bi bi-check-circle-fill text-base"></i>
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="inline-flex items-center justify-center text-slate-300">
        <i className="bi bi-dash-lg text-base"></i>
      </span>
    );
  }
  return (
    <span className="text-xs sm:text-sm font-semibold text-slate-800">
      {value}
    </span>
  );
}

export default function PricingComparisonMatrix() {
  const [leftPlan, setLeftPlan] = useState<string>("premium");
  const [rightPlan, setRightPlan] = useState<string>("premium_gabungan");

  const planKeys = ["free", "premium", "premium_presentasi", "premium_gabungan", "pro"] as const;

  return (
    <div className="w-full space-y-6">
      {/* Mobile Dual Comparator Controls */}
      <div className="lg:hidden rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Pilih 2 Paket untuk Dibandingkan
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="compare-left" className="text-[11px] font-semibold text-slate-500">
              Paket Pertama
            </label>
            <select
              id="compare-left"
              value={leftPlan}
              onChange={(e) => setLeftPlan(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#283157]"
            >
              {planKeys.map((pk) => (
                <option key={pk} value={pk}>
                  {PLAN_META[pk].name} {PLAN_META[pk].popular ? "(Populer)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="compare-right" className="text-[11px] font-semibold text-slate-500">
              Bandingkan Dengan
            </label>
            <select
              id="compare-right"
              value={rightPlan}
              onChange={(e) => setRightPlan(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#283157]"
            >
              {planKeys.map((pk) => (
                <option key={pk} value={pk}>
                  {PLAN_META[pk].name} {PLAN_META[pk].popular ? "(Populer)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Desktop Full 5-Column Table */}
      <div className="hidden lg:block overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th scope="col" className="px-6 py-5 text-xs font-bold uppercase tracking-wider text-slate-400 w-1/3">
                Fitur & Kuota Platform
              </th>
              {planKeys.map((pk) => {
                const meta = PLAN_META[pk];
                return (
                  <th
                    key={pk}
                    scope="col"
                    className={`px-4 py-5 text-center text-xs font-extrabold uppercase tracking-wider ${
                      meta.popular
                        ? "bg-[#283157]/5 text-[#283157]"
                        : "text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{meta.name}</span>
                      {meta.popular && (
                        <i className="bi bi-star-fill text-amber-500 text-[10px]"></i>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {COMPARISON_ROWS.map((row, idx) => (
              <tr
                key={row.label}
                className={`transition hover:bg-slate-50/50 ${
                  idx % 2 === 1 ? "bg-slate-50/30" : ""
                }`}
              >
                <td className="px-6 py-4 text-xs sm:text-sm font-semibold text-slate-800">
                  {row.label}
                </td>
                {planKeys.map((pk) => {
                  const meta = PLAN_META[pk];
                  const val = (row.values as any)[pk];
                  return (
                    <td
                      key={pk}
                      className={`px-4 py-4 text-center ${
                        meta.popular ? "bg-[#283157]/[0.02]" : ""
                      }`}
                    >
                      <CellRenderer value={val} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Dual-Column Comparative Table */}
      <div className="block lg:hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th scope="col" className="p-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 w-2/5">
                Fitur
              </th>
              <th scope="col" className="p-3 text-center text-xs font-extrabold uppercase tracking-wider text-slate-700 w-[30%]">
                {PLAN_META[leftPlan]?.name}
              </th>
              <th scope="col" className="p-3 text-center text-xs font-extrabold uppercase tracking-wider text-[#283157] w-[30%]">
                {PLAN_META[rightPlan]?.name}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {COMPARISON_ROWS.map((row, idx) => (
              <tr
                key={row.label}
                className={idx % 2 === 1 ? "bg-slate-50/40" : ""}
              >
                <td className="p-3 text-xs font-semibold text-slate-800">
                  {row.label}
                </td>
                <td className="p-3 text-center">
                  <CellRenderer value={(row.values as any)[leftPlan]} />
                </td>
                <td className="p-3 text-center bg-[#283157]/[0.03]">
                  <CellRenderer value={(row.values as any)[rightPlan]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

