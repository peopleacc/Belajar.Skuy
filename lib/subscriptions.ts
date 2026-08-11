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
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
  } | null;
};

/**
 * Mengambil informasi lengkap status langganan dan tagihan terakhir user.
 *
 * Dipakai oleh halaman /profile dan /portal untuk menampilkan kartu
 * "Detail Paket dan Pembayaran".
 */
export async function getUserSubscriptionDetails(
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
        .select("id, amount, currency, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const belumLewat =
      !sub?.current_period_end || new Date(sub.current_period_end).getTime() > Date.now();
    const isActive = !!sub && sub.status === "active" && belumLewat && sub.plan_code !== "free";

    return {
      planCode: isActive ? sub.plan_code : (sub?.plan_code ?? "free"),
      status: isActive
        ? "active"
        : sub?.status === "canceled"
        ? "canceled"
        : sub?.status === "past_due"
        ? "past_due"
        : "free",
      isPaidActive: isActive,
      currentPeriodEnd: sub?.current_period_end ?? null,
      provider: sub?.provider ?? null,
      providerRef: sub?.provider_ref ?? null,
      updatedAt: sub?.updated_at ?? null,
      latestOrder: order
        ? {
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            status: order.status,
            createdAt: order.created_at,
          }
        : null,
    };
  } catch (err) {
    console.error("[getUserSubscriptionDetails] error:", err);
    return fallback;
  }
}
