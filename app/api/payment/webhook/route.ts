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

  // ── 4. Ambil data order dari database internal (F05) ──────────────────────
  //    Keamanan F05: Ambil user_id, plan_code, amount, dan durasi secara eksklusif
  //    dari database internal. Jangan pernah percaya custom_field dari payload luar.
  const { data: orderRow, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, plan_code, amount, status, duration_months")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !orderRow) {
    console.error("[webhook] Order tidak ditemukan di database:", orderId, orderErr);
    return NextResponse.json(
      { error: "Order tidak ditemukan." },
      { status: 404 }
    );
  }

  // Verifikasi kesesuaian gross_amount dengan amount yang tersimpan di DB (F05)
  if (Math.round(Number(orderRow.amount)) !== Math.round(Number(grossAmount))) {
    console.error("[webhook] gross_amount mismatch:", {
      orderId,
      dbAmount: orderRow.amount,
      receivedAmount: grossAmount,
    });
    return NextResponse.json(
      { error: "Jumlah pembayaran tidak sesuai." },
      { status: 400 }
    );
  }

  const resolvedUserId = orderRow.user_id;
  const resolvedPlanCode = orderRow.plan_code;

  if (!resolvedUserId || !resolvedPlanCode) {
    console.error("[webhook] Data order tidak memiliki user_id atau plan_code valid:", orderId);
    return NextResponse.json({ error: "Data order tidak valid." }, { status: 422 });
  }

  // ── 5. Idempotensi — jika sudah diproses, abaikan ────────────────────────
  if (orderRow.status === "paid") {
    console.log("[webhook] Order sudah diproses sebelumnya:", orderId);
    return NextResponse.json({ status: "already_processed" });
  }

  // ── 6. Proses berdasarkan status transaksi ────────────────────────────────

  if (isMidtransSuccess(transactionStatus, fraudStatus)) {
    // ── 6a. PEMBAYARAN BERHASIL ───────────────────────────────────────────
    console.log("[webhook] Pembayaran berhasil:", orderId, resolvedPlanCode);

    // Hitung durasi dan period end (F09: Akumulatif jika perpanjangan paket yang sama)
    const months = orderRow.duration_months ?? 1;
    const daysToAdd = months === 12 ? 365 : months * 30;
    const msToAdd = daysToAdd * 24 * 60 * 60 * 1000;

    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_code, status, current_period_end")
      .eq("user_id", resolvedUserId)
      .maybeSingle();

    let baseTime = Date.now();
    if (
      existingSub &&
      existingSub.plan_code === resolvedPlanCode &&
      existingSub.current_period_end
    ) {
      const existingEndMs = new Date(existingSub.current_period_end).getTime();
      if (existingEndMs > baseTime) {
        baseTime = existingEndMs; // Akumulasi hari tersisa dari langganan aktif
      }
    }

    const periodEnd = new Date(baseTime + msToAdd).toISOString();

    // F06: Eksekusi atomik — upsert subscriptions TERLEBIH DAHULU sebelum menandai order 'paid'.
    // Jika upsert subscriptions gagal, return HTTP 500 agar Midtrans me-retry notifikasi ini.
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
      return NextResponse.json(
        { error: "Gagal memperbarui langganan pengguna." },
        { status: 500 }
      );
    }

    // Hanya setelah subscriptions berhasil aktif, tandai status order ke 'paid'
    const { error: orderUpdateErr } = await supabaseAdmin
      .from("orders")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", orderId);

    if (orderUpdateErr) {
      console.warn("[webhook] Peringatan: Gagal memperbarui status order ke paid:", orderUpdateErr);
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
