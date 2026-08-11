import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSnapTransaction } from "@/lib/midtrans";

/**
 * POST /api/payment/create
 *
 * Membuat sesi pembayaran Midtrans Snap untuk upgrade paket.
 *
 * MEKANISME REUSE PENDING SESSION:
 * Sebelum meminta token baru ke Midtrans, endpoint ini memeriksa apakah
 * sudah ada order yang 'pending' dan belum kadaluarsa untuk kombinasi
 * (user_id + plan_code) yang sama. Kalau ada → kembalikan data lama.
 * Ini memastikan:
 *   - Refresh halaman tidak membuat VA/QRIS baru (yang lama tetap bisa dipakai).
 *   - Tidak ada dua order pending sekaligus untuk paket yang sama.
 *   - Tidak ada panggilan Midtrans API yang tidak perlu.
 *
 * Body: { planCode: string }
 * Response: { redirectUrl: string, orderId: string, isReused: boolean }
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
    planCode = body?.planCode;
    if (!planCode || typeof planCode !== "string") throw new Error("invalid");
  } catch {
    return NextResponse.json(
      { error: "Permintaan tidak valid. Sertakan planCode." },
      { status: 400 }
    );
  }

  // ── 3. Tolak jika user mencoba membeli paket gratis ───────────────────────
  if (planCode === "free") {
    return NextResponse.json(
      { error: "Paket gratis tidak memerlukan pembayaran." },
      { status: 400 }
    );
  }

  // ── 4. Tolak jika user sudah aktif di paket yang sama ────────────────────
  const { data: existingSub } = await supabase
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

  // ── 5. Cek apakah ada pending order yang masih bisa digunakan ────────────
  //    (reuse session — user tidak perlu VA/QRIS baru kalau belum kadaluarsa)
  const { data: pendingOrder } = await supabaseAdmin
    .from("orders")
    .select("id, snap_redirect_url, expires_at")
    .eq("user_id", user.id)
    .eq("plan_code", planCode)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingOrder?.snap_redirect_url) {
    // Ada sesi lama yang masih valid — kembalikan tanpa ke Midtrans lagi
    return NextResponse.json({
      redirectUrl: pendingOrder.snap_redirect_url,
      orderId: pendingOrder.id,
      isReused: true,
    });
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
    redirectUrl: snapResult.redirect_url,
    orderId,
    isReused: false,
  });
}
