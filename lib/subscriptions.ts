import { cache } from "react";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

export type SubscriptionDetails = {
  planCode: string;
  status: "active" | "canceled" | "past_due" | "free";
  /** true jika user memiliki paket berbayar yang masih berlaku */
  isPaidActive: boolean;
  /** Tanggal masa aktif berakhir (ISO String) atau null jika paket gratis */
  currentPeriodEnd: string | null;
  provider: string | null;
  providerRef: string | null;
  updatedAt: string | null;
  /** Informasi transaksi / tagihan terakhir */
  latestOrder: {
    id: string;
    planCode: string;
    amount: number;
    currency: string;
    status: "pending" | "paid" | "expired" | "failed" | string;
    snapToken: string | null;
    snapRedirectUrl: string | null;
    expiresAt: string | null;
    createdAt: string;
  } | null;
};

/**
 * Task 14B-SM: Memoized Subscription Details (React.cache)
 * Mengambil informasi lengkap status langganan dan tagihan terakhir user.
 * Dipakai oleh halaman /profile dan /portal untuk menampilkan kartu
 * "Detail Paket dan Pembayaran". Memoized per siklus render request.
 */
export const getUserSubscriptionDetails = cache(async function getUserSubscriptionDetails(
  userId: string
): Promise<SubscriptionDetails> {
  const fallback: SubscriptionDetails = {
    planCode: "free",
    status: "free",
    isPaidActive: false,
    currentPeriodEnd: null,
    provider: null,
    providerRef: null,
    updatedAt: null,
    latestOrder: null,
  };

  if (!supabaseConfigured || !userId) return fallback;

  try {
    const supabase = await createClient();

    const [{ data: sub }, { data: order }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("plan_code, status, current_period_end, provider, provider_ref, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("orders")
        .select("id, plan_code, amount, currency, status, snap_token, snap_redirect_url, expires_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const belumLewat =
      !sub?.current_period_end || new Date(sub.current_period_end).getTime() > Date.now();

    // Task 15B-PW (F09 & F10): Akses berbayar tetap aktif jika paket belum lewat masa berlakunya,
    // bahkan jika statusnya 'canceled' (langganan tidak diperpanjang otomatis).
    const isPaidActive =
      !!sub &&
      (sub.status === "active" || sub.status === "canceled") &&
      belumLewat &&
      sub.plan_code !== "free";

    // F10: Jika masa aktif telah habis (belumLewat === false), planCode efektif jatuh kembali ke "free".
    const effectivePlanCode = isPaidActive ? sub.plan_code : "free";

    return {
      planCode: effectivePlanCode,
      status: isPaidActive
        ? sub.status
        : sub?.status === "canceled"
        ? "canceled"
        : sub?.status === "past_due"
        ? "past_due"
        : "free",
      isPaidActive,
      currentPeriodEnd: sub?.current_period_end ?? null,
      provider: sub?.provider ?? null,
      providerRef: sub?.provider_ref ?? null,
      updatedAt: sub?.updated_at ?? null,
      latestOrder: order
        ? {
            id: order.id,
            planCode: order.plan_code,
            amount: order.amount,
            currency: order.currency,
            status: order.status,
            snapToken: order.snap_token,
            snapRedirectUrl: order.snap_redirect_url,
            expiresAt: order.expires_at,
            createdAt: order.created_at,
          }
        : null,
    };
  } catch (err) {
    console.error("[getUserSubscriptionDetails] error:", err);
    return fallback;
  }
});

import { getUserLimits, type PlanLimits } from "@/lib/plans";

export type QuotaBalance = {
  key: string;
  label: string;
  icon: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt: string;
  unit: string;
  periodType: "week" | "day" | "month";
};

export type UserQuotaSummary = {
  planCode: string;
  balances: {
    presentation: QuotaBalance;
    interview: QuotaBalance;
    modules: QuotaBalance;
    quiz: QuotaBalance;
  };
  features: {
    voicePractice: boolean;
    cameraSkeleton: boolean;
  };
};

function isoWeekOf(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - jan1.getTime()) / 86_400_000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

function periodFor(key: string): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  if (key.endsWith("PerMonth")) return `${y}-${m}`;
  if (key.endsWith("PerWeek")) {
    const { year, week } = isoWeekOf(now);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resetAtFor(key: string): string {
  const now = new Date();
  if (key.endsWith("PerMonth")) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  }
  if (key.endsWith("PerWeek")) {
    const day = now.getUTCDay() || 7;
    const daysUntilNextMonday = 8 - day;
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilNextMonday)
    ).toISOString();
  }
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  ).toISOString();
}

/**
 * Task 6K-QU / Task 14B-SM: Account Quota Telemetry Helper
 * Menghitung sisa & limit penggunaan kuota riil dari `usage_counters` dan `plans.limits`.
 * Menerima opsional preloadedSubDetails untuk menghindari round-trip DB ganda.
 */
export const getUserQuotaBalances = cache(async function getUserQuotaBalances(
  userId: string,
  preloadedSubDetails?: SubscriptionDetails
): Promise<UserQuotaSummary> {
  const subDetails = preloadedSubDetails ?? (await getUserSubscriptionDetails(userId));
  const limits = await getUserLimits(subDetails.planCode);

  const keys = [
    { key: "presentationSessionsPerWeek", id: "presentation", label: "Simulasi Presentasi", icon: "bi-easel2-fill", unit: "sesi", periodType: "week" as const },
    { key: "interviewSessionsPerWeek", id: "interview", label: "Simulasi Wawancara", icon: "bi-briefcase-fill", unit: "sesi", periodType: "week" as const },
    { key: "modulesPerDay", id: "modules", label: "Buat Kursus AI", icon: "bi-journal-code", unit: "modul", periodType: "day" as const },
    { key: "customQuizPerDay", id: "quiz", label: "Kuis Mandiri AI", icon: "bi-patch-question-fill", unit: "kuis", periodType: "day" as const },
  ];

  const usedMap: Record<string, number> = {};

  if (supabaseConfigured && userId) {
    try {
      const supabase = await createClient();
      const periods = keys.map((k) => periodFor(k.key));
      const { data } = await supabase
        .from("usage_counters")
        .select("key, count, period")
        .eq("user_id", userId)
        .in("period", periods);

      if (data) {
        for (const row of data) {
          if (row.period === periodFor(row.key)) {
            usedMap[row.key] = row.count ?? 0;
          }
        }
      }
    } catch (err) {
      console.warn("[getUserQuotaBalances] usage_counters query warning:", err);
    }
  }

  const makeBalance = (item: typeof keys[number], limitVal: number | null | undefined): QuotaBalance => {
    const limit = limitVal ?? null;
    const used = usedMap[item.key] ?? 0;
    const remaining = limit === null ? null : Math.max(limit - used, 0);
    return {
      key: item.key,
      label: item.label,
      icon: item.icon,
      limit,
      used,
      remaining,
      resetAt: resetAtFor(item.key),
      unit: item.unit,
      periodType: item.periodType,
    };
  };

  return {
    planCode: subDetails.planCode,
    balances: {
      presentation: makeBalance(keys[0], limits.presentationSessionsPerWeek),
      interview: makeBalance(keys[1], limits.interviewSessionsPerWeek),
      modules: makeBalance(keys[2], limits.modulesPerDay),
      quiz: makeBalance(keys[3], limits.customQuizPerDay),
    },
    features: {
      voicePractice: Boolean(limits.voicePractice),
      cameraSkeleton: Boolean(limits.cameraSkeleton),
    },
  };
});
