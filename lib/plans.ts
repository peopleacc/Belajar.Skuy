import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import type { Lang } from "@/lib/i18n";
import { formatPrice, type Currency } from "@/lib/format";

export { formatPrice, type Currency };

export type PlanLimits = {
  modulesPerDay: number | null;
  chaptersPerModule: number | null;
  chapterGenerationsPerDay: number | null;
  chatMessagesPerChapter: number | null;
  customQuizPerDay: number | null;
  voicePractice: boolean;
  presentationSessionsPerWeek: number | null;
  interviewSessionsPerWeek: number | null;
};

export type PlanDurationPrice = {
  durationMonths: number;
  /** Total nominal normal (misal 270.000 untuk 6 bulan normal). */
  amount: number;
  /** Total nominal ditagih setelah diskon (misal 216.000 untuk 6 bulan). */
  effectiveAmount: number;
  /** Nilai ekuivalen per bulan (misal 36.000/bln). */
  monthlyEquivalent: number;
  discounted: boolean;
  discountLabel: string | null;
};

export type Plan = {
  code: string;
  sortOrder: number;
  limits: Partial<PlanLimits>;
  /** Harga normal default (1 bulan). */
  amount: number;
  /** Harga efektif default (1 bulan). */
  effectiveAmount: number;
  /** Nilai ekuivalen per bulan default (1 bulan). */
  monthlyEquivalent: number;
  /** true kalau diskon sedang berlaku; UI menampilkan `amount` dicoret. */
  discounted: boolean;
  discountLabel: string | null;
  currency: Currency;
  durationMonths: number;
  /** Detail harga untuk setiap siklus durasi (1, 6, 12 bulan). */
  durations: Record<number, PlanDurationPrice>;
};

/** Bahasa antarmuka menentukan mata uang yang ditampilkan. */
export function currencyForLang(lang: Lang): Currency {
  return lang === "id" ? "IDR" : "USD";
}

/**
 * Batas cadangan — SAMA PERSIS dengan FALLBACK_LIMITS di
 * service/src/lib/entitlements.js dan dengan seed paket `free` di migration 006.
 */
const FALLBACK_USER_LIMITS: PlanLimits = {
  modulesPerDay: 1,
  chaptersPerModule: 3,
  chapterGenerationsPerDay: 6,
  chatMessagesPerChapter: 5,
  customQuizPerDay: 1,
  voicePractice: false,
  presentationSessionsPerWeek: 0,
  interviewSessionsPerWeek: 0,
};

export async function getUserLimits(planCode: string): Promise<PlanLimits> {
  if (!supabaseConfigured) return { ...FALLBACK_USER_LIMITS };
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("plans")
      .select("limits")
      .eq("code", planCode)
      .maybeSingle();
    return { ...FALLBACK_USER_LIMITS, ...((data?.limits ?? {}) as Partial<PlanLimits>) };
  } catch {
    return { ...FALLBACK_USER_LIMITS };
  }
}


/**
 * Nilai cadangan harga baru (planning-update-16):
 * Base 1 Bulan:
 * - free: 0
 * - premium: Rp 45.000 ($3)
 * - premium_presentasi: Rp 60.000 ($4)
 * - premium_gabungan: Rp 100.000 ($7)
 * - pro: Rp 160.000 ($10)
 */
const BASE_PRICES: Record<Currency, { code: string; amount: number }[]> = {
  IDR: [
    { code: "free",                 amount: 0 },
    { code: "premium",              amount: 45000 },
    { code: "premium_presentasi",   amount: 60000 },
    { code: "premium_gabungan",     amount: 100000 },
    { code: "pro",                  amount: 160000 },
  ],
  USD: [
    { code: "free",                 amount: 0 },
    { code: "premium",              amount: 3 },
    { code: "premium_presentasi",   amount: 4 },
    { code: "premium_gabungan",     amount: 7 },
    { code: "pro",                  amount: 10 },
  ],
};

function calculateDurations(baseAmount: number): Record<number, PlanDurationPrice> {
  if (baseAmount === 0) {
    const zeroPrice = (m: number): PlanDurationPrice => ({
      durationMonths: m,
      amount: 0,
      effectiveAmount: 0,
      monthlyEquivalent: 0,
      discounted: false,
      discountLabel: null,
    });
    return { 1: zeroPrice(1), 6: zeroPrice(6), 12: zeroPrice(12) };
  }

  // 1 Bulan: Normal
  const d1: PlanDurationPrice = {
    durationMonths: 1,
    amount: baseAmount,
    effectiveAmount: baseAmount,
    monthlyEquivalent: baseAmount,
    discounted: false,
    discountLabel: null,
  };

  // 6 Bulan: Diskon 20%
  const normal6 = baseAmount * 6;
  const effectiveMonthly6 = Math.round(baseAmount * 0.8);
  const total6 = effectiveMonthly6 * 6;
  const d6: PlanDurationPrice = {
    durationMonths: 6,
    amount: normal6,
    effectiveAmount: total6,
    monthlyEquivalent: effectiveMonthly6,
    discounted: true,
    discountLabel: "Diskon 20%",
  };

  // 12 Bulan (1 Tahun): Diskon 30%
  const normal12 = baseAmount * 12;
  const effectiveMonthly12 = Math.round(baseAmount * 0.7);
  const total12 = effectiveMonthly12 * 12;
  const d12: PlanDurationPrice = {
    durationMonths: 12,
    amount: normal12,
    effectiveAmount: total12,
    monthlyEquivalent: effectiveMonthly12,
    discounted: true,
    discountLabel: "Diskon 30%",
  };

  return { 1: d1, 6: d6, 12: d12 };
}

function fallbackPlans(currency: Currency): Plan[] {
  return BASE_PRICES[currency].map((p, i) => {
    const durations = calculateDurations(p.amount);
    return {
      code: p.code,
      sortOrder: i,
      limits: {},
      amount: durations[1].amount,
      effectiveAmount: durations[1].effectiveAmount,
      monthlyEquivalent: durations[1].monthlyEquivalent,
      discounted: durations[1].discounted,
      discountLabel: durations[1].discountLabel,
      currency,
      durationMonths: 1,
      durations,
    };
  });
}

/**
 * Daftar paket + harga multi-durasi untuk satu mata uang, urut `sort_order`.
 */
export async function getPlans(currency: Currency): Promise<Plan[]> {
  if (!supabaseConfigured) return fallbackPlans(currency);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plans")
      .select(
        "code, sort_order, limits, plan_prices(currency, duration_months, amount, discount_amount, discount_label, discount_starts_at, discount_ends_at)"
      )
      .eq("is_active", true)
      .eq("plan_prices.currency", currency)
      .order("sort_order");

    if (error || !data?.length) return fallbackPlans(currency);

    const now = Date.now();

    const plans = data.map((row: any): Plan => {
      const rawPrices = (row.plan_prices ?? []) as any[];

      // Bangun map durations dari data DB
      const dbDurations: Partial<Record<number, PlanDurationPrice>> = {};

      rawPrices.forEach((price) => {
        const dMonths = price?.duration_months ?? 1;
        const totalAmount: number = price?.amount ?? 0;

        const mulai = price?.discount_starts_at ? Date.parse(price.discount_starts_at) : null;
        const selesai = price?.discount_ends_at ? Date.parse(price.discount_ends_at) : null;
        const dalamRentang =
          (mulai === null || now >= mulai) && (selesai === null || now <= selesai);

        const diskonAktif =
          price?.discount_amount != null && price.discount_amount < totalAmount && dalamRentang;

        const effectiveTotal = diskonAktif ? price.discount_amount : totalAmount;
        const monthlyEq = dMonths > 0 ? Math.round(effectiveTotal / dMonths) : effectiveTotal;

        dbDurations[dMonths] = {
          durationMonths: dMonths,
          amount: totalAmount,
          effectiveAmount: effectiveTotal,
          monthlyEquivalent: monthlyEq,
          discounted: !!diskonAktif,
          discountLabel: diskonAktif ? price.discount_label ?? null : null,
        };
      });

      // Jika data DB belum memiliki 6 / 12 bulan (belum migrasi), hitung otomatis dari harga 1 bulan
      const base1 = dbDurations[1] ?? {
        durationMonths: 1,
        amount: BASE_PRICES[currency].find((b) => b.code === row.code)?.amount ?? 0,
        effectiveAmount: BASE_PRICES[currency].find((b) => b.code === row.code)?.amount ?? 0,
        monthlyEquivalent: BASE_PRICES[currency].find((b) => b.code === row.code)?.amount ?? 0,
        discounted: false,
        discountLabel: null,
      };

      const calculated = calculateDurations(base1.effectiveAmount);
      const fullDurations: Record<number, PlanDurationPrice> = {
        1: dbDurations[1] ?? calculated[1],
        6: dbDurations[6] ?? calculated[6],
        12: dbDurations[12] ?? calculated[12],
      };

      const currentDefault = fullDurations[1];

      return {
        code: row.code,
        sortOrder: row.sort_order,
        limits: (row.limits ?? {}) as Partial<PlanLimits>,
        amount: currentDefault.amount,
        effectiveAmount: currentDefault.effectiveAmount,
        monthlyEquivalent: currentDefault.monthlyEquivalent,
        discounted: currentDefault.discounted,
        discountLabel: currentDefault.discountLabel,
        currency,
        durationMonths: 1,
        durations: fullDurations,
      };
    });

    return plans.length ? plans : fallbackPlans(currency);
  } catch {
    return fallbackPlans(currency);
  }
}
