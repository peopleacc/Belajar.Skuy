export type Currency = "IDR" | "USD";

/**
 * Format harga sesuai mata uangnya.
 * Utilitas murni ini aman diimpor oleh Server Component maupun Client Component.
 */
export function formatPrice(amount: number, currency: Currency): string {
  if (currency === "IDR") {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }
  return `$${amount}`;
}
