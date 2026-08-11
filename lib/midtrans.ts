import crypto from "crypto";

/**
 * Konfigurasi Midtrans dari environment variable.
 *
 * Variabel yang dibutuhkan di next/.env.local:
 *   MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx   ← dari dashboard Midtrans
 *   MIDTRANS_IS_PRODUCTION=false              ← set 'true' saat live
 */
function getServerKey(): string {
  return (process.env.MIDTRANS_SERVER_KEY ?? "").trim();
}

function isProduction(): boolean {
  return process.env.MIDTRANS_IS_PRODUCTION === "true";
}

function getSnapBaseUrl(): string {
  return isProduction()
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";
}

function authHeader(serverKey: string): string {
  return "Basic " + Buffer.from(`${serverKey}:`).toString("base64");
}

// ============================================================
// Types
// ============================================================

export type SnapTransactionParams = {
  orderId: string;
  grossAmount: number;
  currency: "IDR" | "USD";
  /** Nama paket yang dibeli — ditampilkan di halaman Midtrans. */
  planName: string;
  /** Disimpan di custom_field Midtrans untuk diambil kembali saat webhook. */
  userId: string;
  planCode: string;
  /** Data customer untuk tampilan di halaman Midtrans. */
  customer: {
    email: string;
    firstName: string;
  };
  /** URL callback setelah pembayaran selesai (kembali ke app). */
  callbackUrl: {
    finish: string;
    error: string;
    pending: string;
  };
};

export type SnapTransactionResult = {
  token: string;
  redirect_url: string;
};

/**
 * Buat transaksi Midtrans Snap.
 *
 * Mengembalikan `token` dan `redirect_url` — user diarahkan ke `redirect_url`
 * agar bisa memilih metode pembayaran (QRIS, VA, GoPay, dll.) langsung
 * di halaman Midtrans tanpa kita perlu membangun UI pembayaran sendiri.
 *
 * Melempar Error jika Midtrans API gagal (key salah, payload tidak valid, dll.).
 */
export async function createSnapTransaction(
  params: SnapTransactionParams
): Promise<SnapTransactionResult> {
  const serverKey = getServerKey();
  if (!serverKey) {
    throw new Error(
      "MIDTRANS_SERVER_KEY belum dikonfigurasi di environment variable."
    );
  }

  const body = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.grossAmount,
    },
    item_details: [
      {
        id: params.planCode,
        price: params.grossAmount,
        quantity: 1,
        name: `Paket ${params.planName} — belajar.skuy`,
      },
    ],
    customer_details: {
      email: params.customer.email,
      first_name: params.customer.firstName,
    },
    callbacks: {
      finish: params.callbackUrl.finish,
    },
    // custom_field1 & custom_field2 akan dikembalikan Midtrans saat webhook —
    // dipakai untuk tahu user mana dan paket apa yang harus diaktifkan.
    custom_field1: params.userId,
    custom_field2: params.planCode,
    expiry: {
      // Masa berlaku link pembayaran Midtrans: 24 jam
      unit: "hours",
      duration: 24,
    },
  };

  const snapBaseUrl = getSnapBaseUrl();
  const res = await fetch(snapBaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(serverKey),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "no body");
    console.error(`[Midtrans API Error] URL: ${snapBaseUrl}, Status: ${res.status}, Body: ${text}`);
    throw new Error(`Midtrans API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    token: data.token,
    redirect_url: data.redirect_url,
  };
}

// ============================================================
// Verifikasi Signature Key (Webhook Security)
// ============================================================

/**
 * Verifikasi bahwa payload webhook benar-benar dikirim oleh Midtrans.
 *
 * Formula Midtrans:
 *   SHA512( order_id + status_code + gross_amount + server_key )
 *
 * Referensi: https://docs.midtrans.com/docs/verifying-data-authenticity
 *
 * WAJIB DIPAKAI di endpoint webhook — tanpa ini, siapa pun bisa mengirim
 * payload palsu dengan status 'settlement' dan mendapat paket gratis.
 */
export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  receivedSignature: string
): boolean {
  const serverKey = getServerKey();
  if (!serverKey) return false;
  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const expected = crypto.createHash("sha512").update(raw).digest("hex");
  // Bandingkan dengan timingSafeEqual untuk mencegah timing attack
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(receivedSignature, "utf8")
    );
  } catch {
    return false;
  }
}

// ============================================================
// Utilitas
// ============================================================

/**
 * Tentukan apakah status transaksi Midtrans dianggap BERHASIL.
 *
 * - `settlement`: pembayaran berhasil diselesaikan (VA, QRIS, E-wallet, Minimarket)
 * - `capture` + `fraud_status === 'accept'`: kartu kredit berhasil & aman
 */
export function isMidtransSuccess(
  transactionStatus: string,
  fraudStatus: string | null | undefined
): boolean {
  if (transactionStatus === "settlement") return true;
  if (transactionStatus === "capture" && fraudStatus === "accept") return true;
  return false;
}

/**
 * Status Midtrans yang dianggap GAGAL — order bisa ditandai 'failed'.
 */
export function isMidtransFailed(transactionStatus: string): boolean {
  return ["cancel", "deny", "failure"].includes(transactionStatus);
}

/**
 * Status Midtrans yang dianggap KADALUARSA.
 */
export function isMidtransExpired(transactionStatus: string): boolean {
  return transactionStatus === "expire";
}
