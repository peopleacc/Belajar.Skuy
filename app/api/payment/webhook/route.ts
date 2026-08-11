import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  verifyMidtransSignature,
  isMidtransSuccess,
  isMidtransFailed,
  isMidtransExpired,
} from "@/lib/midtrans";

/**
 * POST /api/payment/webhook
 *
 * Endpoint yang didaftarkan di dashboard Midtrans sebagai Notification URL:
 *   https://<domain-anda>/api/payment/webhook
 *
 * Midtrans akan mengirim HTTP POST ke sini setiap kali ada perubahan status
 * transaksi (pembayaran berhasil, dibatalkan, kadaluarsa, dll.).
 *
 * KEAMANAN:
 * 1. Verifikasi signature_key (SHA-512) sebelum memproses apa pun.
 *    Tanpa ini, siapa pun bisa mengirim payload palsu dengan status 'settlement'.
 * 2. Idempotensi: jika order sudah berstatus 'paid', abaikan notifikasi ulang.
 *    Midtrans sering mengirim notifikasi 2–3 kali untuk satu transaksi.
 *
 * TIDAK ADA autentikasi user (cookie/JWT) di sini — request ini datang dari
 * server Midtrans, bukan dari browser user. Validasi dilakukan via signature.
 */
export async function POST(request: Request) {
  // ── 1. Parse payload ──────────────────────────────────────────────────────
  let payload: Record<string, string>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: receivedSignature,
    transaction_status: transactionStatus,
    fraud_status: fraudStatus,
    custom_field1: userId,    // user_id yang disimpan saat membuat order
    custom_field2: planCode,  // plan_code yang disimpan saat membuat order
  } = payload;

  // ── 2. Validasi field wajib ───────────────────────────────────────────────
  if (!orderId || !statusCode || !grossAmount || !receivedSignature) {
    return NextResponse.json(
      { error: "Field wajib tidak lengkap." },
      { status: 400 }
    );
  }

  // ── 3. Verifikasi Signature Key Midtrans ─────────────────────────────────
  //    SHA512(order_id + status_code + gross_amount + SERVER_KEY)
  const isValid = verifyMidtransSignature(
    orderId,
    statusCode,
    grossAmount,
    receivedSignature
  );

  if (!isValid) {
    console.warn("[webhook] Signature tidak valid untuk order:", orderId);
    return NextResponse.json(
      { error: "Signature tidak valid." },
      { status: 403 }
    );
  }

  // ── 4. Ambil data order dari database ────────────────────────────────────
  //    Jika custom_field tidak ada (kasus edge), fallback ke data dari DB.
  const { data: orderRow, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, plan_code, status")
    .eq("id", orderId)
    .maybeSingle();

  // Tentukan user_id dan plan_code yang akan dipakai
  const resolvedUserId = userId || orderRow?.user_id;
  const resolvedPlanCode = planCode || orderRow?.plan_code;

  if (!resolvedUserId || !resolvedPlanCode) {
    console.error("[webhook] Tidak bisa resolve userId/planCode untuk order:", orderId);
    // Tetap balas 200 agar Midtrans tidak retry terus
    return NextResponse.json({ status: "unresolvable" });
  }

  // ── 5. Idempotensi — jika sudah diproses, abaikan ────────────────────────
  if (orderRow?.status === "paid") {
    console.log("[webhook] Order sudah diproses sebelumnya:", orderId);
    return NextResponse.json({ status: "already_processed" });
  }

  // ── 6. Proses berdasarkan status transaksi ────────────────────────────────

  if (isMidtransSuccess(transactionStatus, fraudStatus)) {
    // ── 6a. PEMBAYARAN BERHASIL ───────────────────────────────────────────
    console.log("[webhook] Pembayaran berhasil:", orderId, resolvedPlanCode);

    // Update status order ke 'paid'
    await supabaseAdmin
      .from("orders")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", orderId);

    // Aktifkan / perbarui langganan user di tabel subscriptions.
    // upsert: jika baris belum ada (user baru bayar pertama kali), buat baru.
    //         jika sudah ada (upgrade/perbarui paket), timpa data lama.
    const periodEnd = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 hari dari sekarang
    ).toISOString();

    const { error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: resolvedUserId,
          plan_code: resolvedPlanCode,
          status: "active",
          current_period_end: periodEnd,
          provider: "midtrans",
          provider_ref: orderId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (subErr) {
      console.error("[webhook] Gagal upsert subscriptions:", subErr);
      // Jangan return error 5xx — Midtrans akan retry berulang kali.
      // Log sudah dicatat; rekonsiliasi manual jika perlu.
    }

    return NextResponse.json({ status: "success" });
  }

  if (isMidtransFailed(transactionStatus)) {
    // ── 6b. PEMBAYARAN GAGAL / DIBATALKAN ────────────────────────────────
    console.log("[webhook] Pembayaran gagal/dibatalkan:", orderId);

    await supabaseAdmin
      .from("orders")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", orderId);

    return NextResponse.json({ status: "failed" });
  }

  if (isMidtransExpired(transactionStatus)) {
    // ── 6c. PEMBAYARAN KADALUARSA ─────────────────────────────────────────
    console.log("[webhook] Pembayaran kadaluarsa:", orderId);

    await supabaseAdmin
      .from("orders")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", orderId);

    return NextResponse.json({ status: "expired" });
  }

  // ── 7. Status lain (pending, challenge, dll.) — abaikan ─────────────────
  //    Midtrans akan mengirim notifikasi lagi saat status berubah ke final.
  return NextResponse.json({ status: "ignored", transactionStatus });
}
