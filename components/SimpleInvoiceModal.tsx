"use client";

import { useEffect } from "react";

export type SimpleInvoiceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  planName: string;
  amount: number;
  currency: string;
  paymentDate: string | null;
  periodEnd: string | null;
  customerName?: string;
  customerEmail?: string;
  status?: string;
};

function formatCurrency(amount: number, currency: string): string {
  if (currency === "IDR") {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }
  return `$${amount}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Sesuai ketentuan paket";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Modal Bukti Pembayaran / Invoice Sederhana (Task 3D-IV).
 * Menampilkan ringkasan transaksi langganan resmi dan siap dicetak/simpan PDF (window.print()).
 */
export default function SimpleInvoiceModal({
  isOpen,
  onClose,
  orderId,
  planName,
  amount,
  currency,
  paymentDate,
  periodEnd,
  customerName = "Pelanggan belajar.skuy",
  customerEmail = "-",
  status = "paid",
}: SimpleInvoiceModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  const invoiceNumber = `INV-${orderId.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:static">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-printable,
          #invoice-printable * {
            visibility: visible;
          }
          #invoice-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 24px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="invoice-printable"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 print:border-none print:shadow-none"
      >
        {/* Header Invoice */}
        <div className="flex flex-wrap items-start justify-between gap-4 p-6 md:p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white text-2xl font-black shadow-sm">
              <i className="bi bi-mortarboard-fill"></i>
            </span>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-brand-600">
                belajar.skuy
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Invoice Pembayaran
              </h2>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <i className="bi bi-check-circle-fill text-emerald-500"></i>
              {status === "paid" || status === "settlement" ? "Lunas / Berhasil" : "Sukses"}
            </span>
            <p className="mt-1 font-mono text-xs text-slate-500 font-semibold">
              {invoiceNumber}
            </p>
          </div>
        </div>

        {/* Informasi Pelanggan & Transaksi */}
        <div className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs border-b border-slate-100 pb-6">
            <div>
              <p className="font-bold uppercase tracking-wider text-slate-400 mb-1">
                Ditagihkan Kepada:
              </p>
              <p className="text-sm font-bold text-slate-800">{customerName}</p>
              <p className="text-slate-600 mt-0.5">{customerEmail}</p>
            </div>

            <div>
              <p className="font-bold uppercase tracking-wider text-slate-400 mb-1">
                Detail Transaksi:
              </p>
              <div className="space-y-1 text-slate-600">
                <p>
                  <strong className="text-slate-700">Tanggal Bayar:</strong>{" "}
                  {formatDate(paymentDate)}
                </p>
                <p>
                  <strong className="text-slate-700">Masa Aktif:</strong> s/d{" "}
                  {formatDate(periodEnd)}
                </p>
                <p>
                  <strong className="text-slate-700">Gateway:</strong> Midtrans Payment
                </p>
              </div>
            </div>
          </div>

          {/* Rincian Tagihan */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Rincian Pembelian
            </h4>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Deskripsi Layanan</th>
                    <th className="py-2.5 px-4 text-center">Durasi</th>
                    <th className="py-2.5 px-4 text-right">Harga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">Paket Langganan {planName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Akses penuh fitur latihan presentasi, wawancara, audio-visual feedback & laporan AI
                      </p>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600">1 Periode</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                      {formatCurrency(amount, currency)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-50/70 border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-4 text-right text-slate-500 font-medium">
                      Subtotal
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-700">
                      {formatCurrency(amount, currency)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="py-2 px-4 text-right text-slate-500 font-medium">
                      Pajak &amp; Biaya Layanan
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-emerald-600 font-medium">
                      Termasuk (Rp 0)
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 bg-brand-50/30">
                    <td colSpan={2} className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                      Total Pembayaran
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-brand-600 text-sm">
                      {formatCurrency(amount, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Catatan Kaki */}
          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
            <p>
              <strong>Catatan:</strong> Dokumen ini adalah bukti transaksi sah yang diterbitkan
              secara otomatis oleh sistem <strong>belajar.skuy</strong> melalui payment gateway Midtrans.
              Simpan bukti ini untuk keperluan arsip atau pembukuan Anda.
            </p>
          </div>
        </div>

        {/* Footer Tombol Aksi (Disembunyikan saat mencetak) */}
        <div className="no-print flex items-center justify-between p-4 md:px-8 border-t border-slate-100 bg-slate-50/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-600 transition"
          >
            <i className="bi bi-printer-fill"></i>
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}

