import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import type { Lang } from "@/lib/i18n";

export type Currency = "IDR" | "USD";

export type PlanLimits = {
  modulesPerDay: number | null;
  chaptersPerModule: number | null;
  chapterGenerationsPerDay: number | null;
  chatMessagesPerChapter: number | null;
  customQuizPerDay: number | null;
  voicePractice: boolean;
  // Fitur EC (planning-update-12): kuota simulasi dipisah per jenis & satuan
  // berubah dari per-bulan ke per-minggu. simulationSessionsPerMonth dihapus.
  presentationSessionsPerWeek: number | null;
  interviewSessionsPerWeek: number | null;
};

export type Plan = {
  code: string;
  sortOrder: number;
  limits: Partial<PlanLimits>;
  /** Harga normal, satuan penuh (5 / 80000). */
  amount: number;
  /** Harga yang BERLAKU sekarang — sudah memperhitungkan diskon & rentang tanggalnya. */
  effectiveAmount: number;
  /** true kalau diskon sedang berlaku; UI menampilkan `amount` dicoret. */
  discounted: boolean;
  discountLabel: string | null;
  currency: Currency;
};

/** Bahasa antarmuka menentukan mata uang yang ditampilkan. */
export function currencyForLang(lang: Lang): Currency {
  return lang === "id" ? "IDR" : "USD";
}

/**
 * Batas cadangan — SAMA PERSIS dengan FALLBACK_LIMITS di
 * service/src/lib/entitlements.js dan dengan seed paket `free` di migration 006.
 *
 * Dipakai kalau database tak terjangkau. Sengaja memakai angka paket GRATIS:
 * kalau paket seseorang tidak bisa dipastikan, menampilkan fitur berbayar sebagai
 * terbuka hanya akan berujung ditolak server — lebih baik terkunci lalu terbuka
 * daripada terlihat terbuka lalu gagal.
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

/**
 * Fitur CD — batas paket user untuk keperluan TAMPILAN (mengunci tombol,
 * menampilkan sisa kuota).
 *
 * Ini BUKAN pengaman. Penegakan yang sesungguhnya ada di Express
 * (`entitlements.js`), karena endpoint bisa dipanggil langsung tanpa lewat UI.
 * Yang di sini hanya supaya user tidak memencet tombol yang pasti ditolak.
 */
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

/** Format harga sesuai mata uangnya. */
export function formatPrice(amount: number, currency: Currency): string {
  if (currency === "IDR") {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }
  return `$${amount}`;
}

/**
 * Nilai cadangan kalau database tak terjangkau. Halaman harga TIDAK BOLEH blank
 * hanya karena satu query gagal — pengunjung yang mau membeli harus tetap melihat
 * sesuatu. Angkanya sengaja sama dengan seed migration 006 + 012 (Fitur EC).
 */
const FALLBACK: Record<Currency, { code: string; amount: number }[]> = {
  IDR: [
    { code: "free",                 amount: 0 },
    { code: "premium",              amount: 80000 },
    { code: "premium_presentasi",   amount: 100000 },
    { code: "premium_gabungan",     amount: 140000 },
    { code: "pro",                  amount: 250000 },
  ],
  USD: [
    { code: "free",                 amount: 0 },
    { code: "premium",              amount: 5 },
    { code: "premium_presentasi",   amount: 7 },
    { code: "premium_gabungan",     amount: 9 },
    { code: "pro",                  amount: 15 },
  ],
};

function fallbackPlans(currency: Currency): Plan[] {
  return FALLBACK[currency].map((p, i) => ({
    code: p.code,
    sortOrder: i,
    limits: {},
    amount: p.amount,
    effectiveAmount: p.amount,
    discounted: false,
    discountLabel: null,
    currency,
  }));
}

/**
 * Fitur CB — daftar paket + harga berlaku untuk satu mata uang, urut `sort_order`.
 *
 * Diskon dievaluasi SAAT DIBACA (bandingkan `now()` dengan rentang tanggalnya),
 * bukan lewat cron — prinsip yang sama dengan masa berlaku langganan. Promo jadi
 * bisa dijadwalkan dan berakhir sendiri, tanpa proses yang bisa gagal jalan.
 */
export async function getPlans(currency: Currency): Promise<Plan[]> {
  if (!supabaseConfigured) return fallbackPlans(currency);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plans")
      .select(
        "code, sort_order, limits, plan_prices(currency, amount, discount_amount, discount_label, discount_starts_at, discount_ends_at)"
      )
      .eq("is_active", true)
      .eq("plan_prices.currency", currency)
      .order("sort_order");

    if (error || !data?.length) return fallbackPlans(currency);

    const now = Date.now();

    const plans = data.map((row: any): Plan => {
      const price = row.plan_prices?.[0];
      const amount: number = price?.amount ?? 0;

      const mulai = price?.discount_starts_at ? Date.parse(price.discount_starts_at) : null;
      const selesai = price?.discount_ends_at ? Date.parse(price.discount_ends_at) : null;
      const dalamRentang =
        (mulai === null || now >= mulai) && (selesai === null || now <= selesai);

      const diskonAktif =
        price?.discount_amount != null && price.discount_amount < amount && dalamRentang;

      return {
        code: row.code,
        sortOrder: row.sort_order,
        limits: (row.limits ?? {}) as Partial<PlanLimits>,
        amount,
        effectiveAmount: diskonAktif ? price.discount_amount : amount,
        discounted: !!diskonAktif,
        discountLabel: diskonAktif ? price.discount_label ?? null : null,
        currency,
      };
    });

    return plans.length ? plans : fallbackPlans(currency);
  } catch {
    return fallbackPlans(currency);
  }
}
