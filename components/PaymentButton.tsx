"use client";

import { useState } from "react";

type PaymentButtonProps = {
  planCode: string;
  planName: string;
  isLoggedIn: boolean;
  isCurrent: boolean;
  isPopular: boolean;
  ctaText: string;
  currentCtaText: string;
};

/**
 * Tombol checkout pembayaran — client component karena butuh state (loading/error).
 *
 * Alur:
 * 1. Jika user belum login → redirect ke /login?redirect=/pricing
 * 2. Jika paket = 'free' → redirect ke /register (tidak ada pembayaran)
 * 3. Jika user sudah di paket ini → tombol disabled
 * 4. Jika berbayar dan belum aktif:
 *    a. Panggil POST /api/payment/create
 *    b. Terima { redirectUrl }
 *    c. Redirect browser ke halaman pembayaran Midtrans
 *
 * REUSE PENDING SESSION ditangani di server (API route), bukan di sini.
 * Komponen ini cukup memanggil /api/payment/create dan mengikuti redirect.
 */
export default function PaymentButton({
  planCode,
  planName,
  isLoggedIn,
  isCurrent,
  isPopular,
  ctaText,
  currentCtaText,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Style tombol (sama dengan desain PricingPlans yang sudah ada) ─────────
  const baseClass = "rounded-xl py-3.5 text-center text-sm font-semibold transition w-full block";
  const primaryClass = isPopular
    ? "bg-white text-brand-500 hover:opacity-90"
    : "border border-brand-500 text-brand-500 hover:bg-brand-500 hover:text-white";
  const disabledClass = isPopular
    ? "bg-white/20 text-white cursor-default"
    : "bg-surface-2 text-slate-500 cursor-default";
  const loadingClass = "opacity-70 cursor-wait";

  // ── Tombol paket saat ini ─────────────────────────────────────────────────
  if (isCurrent) {
    return (
      <span
        aria-disabled="true"
        className={`${baseClass} ${disabledClass}`}
      >
        {currentCtaText}
      </span>
    );
  }

  // ── Tombol paket gratis (tidak perlu pembayaran) ──────────────────────────
  if (planCode === "free") {
    return (
      <a
        href={isLoggedIn ? "/dashboard" : "/register"}
        className={`${baseClass} ${primaryClass}`}
      >
        {ctaText}
      </a>
    );
  }

  // ── Handler checkout pembayaran ───────────────────────────────────────────
  async function handleCheckout() {
    if (!isLoggedIn) {
      window.location.href = "/login?redirect=/pricing";
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          data?.error ?? "Terjadi kesalahan. Silakan coba lagi."
        );
        return;
      }

      if (data?.redirectUrl) {
        // Arahkan ke halaman pembayaran Midtrans
        window.location.href = data.redirectUrl;
      } else {
        setError("Respons tidak valid dari server. Silakan coba lagi.");
      }
    } catch {
      setError("Tidak bisa terhubung ke server. Periksa koneksi internetmu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={`${baseClass} ${primaryClass} ${loading ? loadingClass : ""}`}
        aria-busy={loading}
        id={`payment-btn-${planCode}`}
      >
        {loading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Menyiapkan pembayaran…
          </span>
        ) : (
          ctaText
        )}
      </button>

      {error && (
        <p
          role="alert"
          className={`text-center text-xs ${isPopular ? "text-white/80" : "text-red-500"}`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
