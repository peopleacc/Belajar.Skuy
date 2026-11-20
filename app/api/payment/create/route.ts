import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSnapTransaction, cancelMidtransTransaction } from "@/lib/midtrans";
import { getAppUrl } from "@/lib/url";

// Daftar paket berbayar resmi platform
const VALID_PAID_PLANS = [
  "premium",
  "premium_presentasi",
  "premium_gabungan",
  "pro",
] as const;

// Harga bulanan dasar cadangan jika tabel plan_prices belum terisi
const BASE_MONTHLY_PRICES: Record<string, number> = {
  premium: 45000,
  premium_presentasi: 60000,
  premium_gabungan: 100000,
  pro: 160000,
};

// Task 15B-PW: In-memory mutex per user untuk mencegah double-click checkout race condition (F08)
const activeCheckoutLocks = new Set<string>();

/**
 * POST /api/payment/create
 *
 * Membuat sesi pembayaran Midtrans Snap untuk upgrade/perpanjangan paket.
 * Mendukung multi-durasi: durationMonths = 1 | 6 | 12
 *
 * Body: { planCode: string, durationMonths?: number }
 * Response: { token: string, redirectUrl: string, orderId: string, isReused: boolean }
 */
export async function POST(request: Request) {
  // ── 1. Autentikasi ────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Silakan login dulu untuk melanjutkan pembayaran." },
      { status: 401 }
    );
  }

  // ── Concurrency Lock (F08) ────────────────────────────────────────────────
  if (activeCheckoutLocks.has(user.id)) {
    return NextResponse.json(
      { error: "Permintaan pembuatan tagihan sedang diproses. Mohon tunggu sebentar." },
      { status: 429 }
    );
  }
  activeCheckoutLocks.add(user.id);

  try {
    // ── 2. Validasi body ketat (F07) ──────────────────────────────────────────
    let planCode: string;
    let durationMonths = 1;
    try {
      const body = await request.json();
      planCode = typeof body?.planCode === "string" ? body.planCode.trim() : "";
      const parsedDuration = Number(body?.durationMonths);
      if ([1, 6, 12].includes(parsedDuration)) {
        durationMonths = parsedDuration;
      }
    } catch {
      return NextResponse.json(
        { error: "Format request tidak valid." },
        { status: 400 }
      );
    }

    // Task 15B-PW (F07 Remediation): Tolak tegas paket tak dikenal (jangan fallback Rp45.000)
    if (!VALID_PAID_PLANS.includes(planCode as any)) {
      return NextResponse.json(
        { error: "Kode paket tidak valid atau tidak tersedia untuk dibeli." },
        { status: 400 }
      );
    }

    // ── 3. Validasi status langganan aktif & izinkan perpanjangan (F09) ───────
    // User diizinkan memperpanjang paket yang sedang berjalan (akumulatif di webhook).
    // Batasi hanya jika akumulasi masa aktif sudah melebihi 2 tahun (730 hari) untuk mencegah abuse.
    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_code, status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingSub?.status === "active" && existingSub.current_period_end) {
      const sisaHari = Math.ceil(
        (new Date(existingSub.current_period_end).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      if (sisaHari > 730) {
        return NextResponse.json(
          { error: "Masa aktif paketmu saat ini sudah lebih dari 2 tahun. Belum dapat melakukan perpanjangan lagi." },
          { status: 409 }
        );
      }
    }

    // ── 4. Cek pending orders & Auto-Cancel tagihan lama jika ganti paket/durasi ──
    const { data: activePendingOrders } = await supabaseAdmin
      .from("orders")
      .select("id, plan_code, duration_months, snap_token, snap_redirect_url, expires_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    // A. Jika ada tagihan pending untuk PAKET & DURASI YANG SAMA -> gunakan kembali (reuse)
    const sameOrderPending = activePendingOrders?.find(
      (o) => o.plan_code === planCode && (o.duration_months ?? 1) === durationMonths
    );
    if (sameOrderPending?.snap_redirect_url) {
      return NextResponse.json({
        token: sameOrderPending.snap_token,
        redirectUrl: sameOrderPending.snap_redirect_url,
        orderId: sameOrderPending.id,
        isReused: true,
      });
    }

    // B. Jika ada tagihan pending untuk paket/durasi lain -> batalkan semuanya di Midtrans & DB
    const otherPendingOrders =
      activePendingOrders?.filter((o) => o.id !== sameOrderPending?.id) ?? [];
    if (otherPendingOrders.length > 0) {
      await Promise.all(
        otherPendingOrders.map(async (oldOrder) => {
          try {
            await cancelMidtransTransaction(oldOrder.id);
          } catch {}
          await supabaseAdmin
            .from("orders")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", oldOrder.id);
        })
      );
    }

    // ── 5. Ambil harga paket dari database / catalog resmi ─────────────────────
    let chargedAmount = 0;

    const { data: priceRow } = await supabaseAdmin
      .from("plan_prices")
      .select("amount, discount_amount, duration_months")
      .eq("plan_code", planCode)
      .eq("currency", "IDR")
      .eq("duration_months", durationMonths)
      .maybeSingle();

    if (priceRow) {
      chargedAmount = priceRow.discount_amount ?? priceRow.amount;
    } else {
      const base = BASE_MONTHLY_PRICES[planCode];
      if (durationMonths === 6) {
        chargedAmount = Math.round(base * 0.8) * 6; // Diskon 20%
      } else if (durationMonths === 12) {
        chargedAmount = Math.round(base * 0.7) * 12; // Diskon 30%
      } else {
        chargedAmount = base;
      }
    }

    if (!chargedAmount || chargedAmount <= 0) {
      return NextResponse.json(
        { error: "Harga paket tidak dapat ditentukan." },
        { status: 400 }
      );
    }

    // ── 6. Ambil info profil user ─────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, full_name")
      .eq("id", user.id)
      .maybeSingle();

    // ── 7. Buat order ID unik (Midtrans max 50 chars) ─────────────────────────
    const shortUserId = user.id.replace(/-/g, "").slice(0, 8).toUpperCase();
    const PLAN_ABBR: Record<string, string> = {
      premium: "PREM",
      premium_presentasi: "PRES",
      premium_gabungan: "GABUNG",
      pro: "PRO",
    };
    const planTag = PLAN_ABBR[planCode] ?? planCode.slice(0, 6).toUpperCase();
    const orderId = `ORD-${shortUserId}-${planTag}-${durationMonths}M-${Date.now()}`;

    // ── 8. Buat transaksi Snap di Midtrans ────────────────────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || getAppUrl();
    const planNames: Record<string, string> = {
      premium: "Premium",
      premium_presentasi: "Pres",
      premium_gabungan: "Gabungan",
      pro: "Pro",
    };
    const planLabel = `${planNames[planCode] ?? planCode} (${durationMonths} Bln)`;

    let snapResult;
    try {
      snapResult = await createSnapTransaction({
        orderId,
        grossAmount: chargedAmount,
        currency: "IDR",
        planName: planLabel,
        userId: user.id,
        planCode,
        customer: {
          email: user.email ?? "user@example.com",
          firstName:
            profile?.full_name ?? profile?.username ?? user.email?.split("@")[0] ?? "User",
        },
        callbackUrl: {
          finish: `${appUrl}/pricing?payment=success`,
          error: `${appUrl}/pricing?payment=error`,
          pending: `${appUrl}/pricing?payment=pending`,
        },
      });
    } catch (err) {
      const detailMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("[payment/create] Midtrans error detail:", detailMsg);
      return NextResponse.json(
        { error: `Gagal membuat tagihan pembayaran: ${detailMsg}` },
        { status: 502 }
      );
    }

    // ── 9. Simpan order ke database secara aman (F07) ──────────────────────────
    // Task 15B-PW: Jika insert DB gagal, jangan biarkan floating token keluar.
    const { error: insertErr } = await supabaseAdmin.from("orders").insert({
      id: orderId,
      user_id: user.id,
      plan_code: planCode,
      amount: chargedAmount,
      currency: "IDR",
      status: "pending",
      duration_months: durationMonths,
      snap_token: snapResult.token,
      snap_redirect_url: snapResult.redirect_url,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    if (insertErr) {
      console.error("[payment/create] DB insert error:", insertErr);
      // Batalkan token remote agar tidak menjadi order liar
      try {
        await cancelMidtransTransaction(orderId);
      } catch {}
      return NextResponse.json(
        { error: "Gagal menyimpan data pesanan di sistem internal. Silakan coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      token: snapResult.token,
      redirectUrl: snapResult.redirect_url,
      orderId,
      isReused: false,
    });
  } finally {
    activeCheckoutLocks.delete(user.id);
  }
}
