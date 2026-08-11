import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSnapTransaction, cancelMidtransTransaction } from "@/lib/midtrans";

/**
 * POST /api/payment/create
 *
 * Membuat sesi pembayaran Midtrans Snap untuk upgrade paket.
 *
 * MEKANISME SINGLE ACTIVE INVOICE & REUSE PENDING SESSION:
 * 1. Jika user memilih paket yang SAMA dengan tagihan pending yang masih aktif:
 *    -> Gunakan kembali (reuse) sesi lama tanpa membuat VA/QRIS baru.
 * 2. Jika user memilih paket yang BERBEDA:
 *    -> Otomatis batalkan (cancel) tagihan lama di Midtrans & Supabase
 *       sehingga nomor VA/QRIS lama langsung mati dan user tidak bisa bayar 2 kali.
 *
 * Body: { planCode: string }
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
  try {
    const body = await request.json();
    planCode = typeof body?.planCode === "string" ? body.planCode.trim() : "";
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

  // ── 3. Ambil profil user untuk validasi email ─────────────────────────────
  const userEmail = user.email ?? "";

  // ── 4. Cek apakah user SUDAH memiliki paket ini yang sedang aktif ─────────
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

  // ── 5. Cek pending orders & Auto-Cancel tagihan lama jika ganti paket ──────
  //    Aturan: 1 user hanya memiliki 1 tagihan aktif dalam satu waktu.
  const { data: activePendingOrders } = await supabaseAdmin
    .from("orders")
    .select("id, plan_code, snap_token, snap_redirect_url, expires_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  // A. Jika ada tagihan pending untuk PAKET YANG SAMA -> gunakan kembali (reuse)
  const samePlanPending = activePendingOrders?.find((o) => o.plan_code === planCode);
  if (samePlanPending?.snap_redirect_url) {
    return NextResponse.json({
      token: samePlanPending.snap_token,
      redirectUrl: samePlanPending.snap_redirect_url,
      orderId: samePlanPending.id,
      isReused: true,
    });
  }

  // B. Jika ada tagihan pending untuk PAKET LAIN -> batalkan semuanya di Midtrans & DB
  const otherPlanPendingOrders =
    activePendingOrders?.filter((o) => o.plan_code !== planCode) ?? [];
  if (otherPlanPendingOrders.length > 0) {
    await Promise.all(
      otherPlanPendingOrders.map(async (oldOrder) => {
        // Matikan nomor pembayaran di Midtrans
        await cancelMidtransTransaction(oldOrder.id);
        // Ubah status di database menjadi canceled
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

  // ── 6. Ambil harga paket dari database ────────────────────────────────────
  //    Kita ambil harga IDR karena Midtrans dalam konteks Indonesia
  const { data: priceRow } = await supabaseAdmin
    .from("plan_prices")
    .select("amount, plan_code, plans(code)")
    .eq("plan_code", planCode)
    .eq("currency", "IDR")
    .maybeSingle();

  if (!priceRow || priceRow.amount === 0) {
    return NextResponse.json(
      { error: "Paket tidak ditemukan atau tidak memerlukan pembayaran." },
      { status: 404 }
    );
  }

  // ── 7. Ambil info user untuk metadata Midtrans ────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name")
    .eq("id", user.id)
    .maybeSingle();

  // ── 8. Buat order ID unik ─────────────────────────────────────────────────
  //    Format: ORDER-<8char-userid>-<plancode>-<timestamp-ms>
  const shortUserId = user.id.replace(/-/g, "").slice(0, 8).toUpperCase();
  const orderId = `ORDER-${shortUserId}-${planCode.toUpperCase()}-${Date.now()}`;

  // ── 9. Buat transaksi Snap di Midtrans ────────────────────────────────────
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let snapResult;
  try {
    snapResult = await createSnapTransaction({
      orderId,
      grossAmount: priceRow.amount,
      currency: "IDR",
      planName: planCode,
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

  // ── 10. Simpan order ke database ──────────────────────────────────────────
  const { error: insertErr } = await supabaseAdmin.from("orders").insert({
    id: orderId,
    user_id: user.id,
    plan_code: planCode,
    amount: priceRow.amount,
    currency: "IDR",
    status: "pending",
    snap_token: snapResult.token,
    snap_redirect_url: snapResult.redirect_url,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  if (insertErr) {
    console.error("[payment/create] DB insert error:", insertErr);
    // Order sudah dibuat di Midtrans tapi DB gagal — tetap beri redirect URL
    // agar user tidak tersangkut. Order akan direkonsiliasi saat webhook masuk.
  }

  return NextResponse.json({
    token: snapResult.token,
    redirectUrl: snapResult.redirect_url,
    orderId,
    isReused: false,
  });
}
