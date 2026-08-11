import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { apiFetch } from "@/lib/api";

/**
 * POST /api/payment/cancel
 *
 * Membatalkan paket langganan berbayar user seketika.
 *
 * Alur:
 * 1. Validasi sesi login user (JWT via cookies).
 * 2. Cek apakah user sedang berada di paket berbayar aktif.
 * 3. Update tabel subscriptions:
 *    - status: 'canceled'
 *    - current_period_end: new Date().toISOString() (akses premium langsung dicabut)
 *    - updated_at: new Date().toISOString()
 * 4. Panggil Express internal route /api/entitlements/invalidate untuk
 *    membersihkan cache kuota Redis seketika.
 * 5. Return status sukses.
 */
export async function POST() {
  // ── 1. Autentikasi user ───────────────────────────────────────────────────
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

  // ── 2. Cek status langganan saat ini ─────────────────────────────────────
  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select("plan_code, status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (subErr) {
    console.error("[payment/cancel] error querying subscription:", subErr);
    return NextResponse.json(
      { error: "Gagal memeriksa status langganan." },
      { status: 500 }
    );
  }

  const belumLewat =
    !sub?.current_period_end || new Date(sub.current_period_end).getTime() > Date.now();
  const isPaidActive = !!sub && sub.status === "active" && belumLewat && sub.plan_code !== "free";

  if (!isPaidActive) {
    return NextResponse.json(
      { error: "Kamu tidak memiliki paket berbayar yang sedang aktif." },
      { status: 400 }
    );
  }

  // ── 3. Update status subscriptions ke 'canceled' ─────────────────────────
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "canceled",
      current_period_end: nowIso,
      updated_at: nowIso,
    })
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("[payment/cancel] error updating subscription:", updateErr);
    return NextResponse.json(
      { error: "Gagal membatalkan langganan. Silakan coba lagi." },
      { status: 500 }
    );
  }

  // ── 4. Invalidate cache Redis di Express Service ─────────────────────────
  try {
    await apiFetch("/api/entitlements/invalidate", { userId: user.id });
  } catch {
    // Tidak memblokir respon sukses jika Express sedang offline — TTL Redis 60 detik
  }

  return NextResponse.json({
    success: true,
    message: "Paket langganan berhasil dibatalkan. Akunmu kini kembali ke paket Gratis.",
  });
}
