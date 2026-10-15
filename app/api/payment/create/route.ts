import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSnapTransaction, cancelMidtransTransaction } from "@/lib/midtrans";

// Harga bulanan dasar cadangan jika DB belum dimigrasi
const BASE_MONTHLY_PRICES: Record<string, number> = {
  premium: 45000,
  premium_presentasi: 60000,
  premium_gabungan: 100000,
  pro: 160000,
};

/**
 * POST /api/payment/create
 *
 * Membuat sesi pembayaran Midtrans Snap untuk upgrade paket.
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

  // ── 2. Validasi body ──────────────────────────────────────────────────────
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

  if (!planCode || planCode === "free") {
    return NextResponse.json(
      { error: "Kode paket tidak valid." },
      { status: 400 }
    );
  }

  // ── 3. Cek apakah user SUDAH memiliki paket ini yang sedang aktif ─────────
  const { data: existingSub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_code, status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingSub?.status === "active" && existingSub.plan_code === planCode) {
    const masaBerlaku = existingSub.current_period_end
      ? new Date(existingSub.current_period_end).getTime()
      : Infinity;
    if (masaBerlaku > Date.now()) {
      return NextResponse.json(
        { error: "Paket ini sudah aktif di akunmu." },
        { status: 409 }
      );
    }
  }

  // ── 4. Cek pending orders & Auto-Cancel tagihan lama jika ganti paket/durasi ──
  //    Aturan: 1 user hanya memiliki 1 tagihan aktif dalam satu waktu.
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
        await cancelMidtransTransaction(oldOrder.id);
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

  // ── 5. Ambil harga paket dari database ────────────────────────────────────
  let chargedAmount = 0;

  // Coba cari harga spesifik durasi
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
    // Fallback formula perhitungan diskon jika tabel migration belum di-run
    const base = BASE_MONTHLY_PRICES[planCode] ?? 45000;
    if (durationMonths === 6) {
      chargedAmount = Math.round(base * 0.8) * 6; // Diskon 20%
    } else if (durationMonths === 12) {
      chargedAmount = Math.round(base * 0.7) * 12; // Diskon 30%
    } else {
      chargedAmount = base;
    }
  }

  if (chargedAmount <= 0) {
    return NextResponse.json(
      { error: "Paket tidak ditemukan atau tidak memerlukan pembayaran." },
      { status: 404 }
    );
  }

  // ── 6. Ambil info user untuk metadata Midtrans ────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name")
    .eq("id", user.id)
    .maybeSingle();

  // ── 7. Buat order ID unik (Midtrans mewajibkan order_id <= 50 karakter) ──
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
      {
        error: `Gagal membuat tagihan pembayaran: ${detailMsg}`,
      },
      { status: 502 }
    );
  }

  // ── 9. Simpan order ke database ──────────────────────────────────────────
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
  }

  return NextResponse.json({
    token: snapResult.token,
    redirectUrl: snapResult.redirect_url,
    orderId,
    isReused: false,
  });
}
