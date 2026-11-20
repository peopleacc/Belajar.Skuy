import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cancelMidtransTransaction } from "@/lib/midtrans";

/**
 * POST /api/payment/cancel-order
 *
 * Membatalkan transaksi pesanan (order) yang sedang berstatus 'pending'.
 * 
 * Body: { orderId: string }
 *
 * Alur:
 * 1. Autentikasi user via session.
 * 2. Cek apakah order milik user dan berstatus 'pending'.
 * 3. Batalkan transaksi di Midtrans via cancelMidtransTransaction (jika server key ada).
 * 4. Update status order menjadi 'canceled' di tabel orders.
 */
export async function POST(request: Request) {
  // ── 1. Autentikasi ────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Silakan login terlebih dahulu." },
      { status: 401 }
    );
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let orderId: string;
  try {
    const body = await request.json();
    orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
  } catch {
    return NextResponse.json(
      { error: "Format request tidak valid." },
      { status: 400 }
    );
  }

  if (!orderId) {
    return NextResponse.json(
      { error: "ID pesanan wajib disertakan." },
      { status: 400 }
    );
  }

  // ── 3. Ambil dan validasi kepemilikan order ───────────────────────────────
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json(
      { error: "Pesanan tidak ditemukan." },
      { status: 404 }
    );
  }

  if (order.user_id !== user.id) {
    return NextResponse.json(
      { error: "Kamu tidak memiliki akses untuk membatalkan pesanan ini." },
      { status: 403 }
    );
  }

  if (order.status !== "pending") {
    return NextResponse.json(
      { error: `Pesanan tidak bisa dibatalkan karena berstatus "${order.status}".` },
      { status: 400 }
    );
  }

  // ── 4. Batalkan di Midtrans (jika ada transaksi aktif) ────────────────────
  try {
    await cancelMidtransTransaction(orderId);
  } catch (err) {
    console.warn(`[cancel-order] Peringatan saat membatalkan transaksi Midtrans ${orderId}:`, err);
    // Tetap lanjut update DB lokal meskipun Midtrans sudah expire/batal lebih awal
  }

  // ── 5. Update status order ke 'canceled' di database ───────────────────────
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await supabaseAdmin
    .from("orders")
    .update({
      status: "canceled",
      updated_at: nowIso,
    })
    .eq("id", orderId);

  if (updateErr) {
    console.error("[cancel-order] Gagal memperbarui status order:", updateErr);
    return NextResponse.json(
      { error: "Gagal membatalkan pesanan di database." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Pesanan tagihan berhasil dibatalkan.",
  });
}

