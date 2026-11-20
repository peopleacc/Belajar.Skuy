"use client";

import { useEffect, useState } from "react";

export type PdfViewerPaneProps = {
  sourceFilePath: string | null;
  sourceFileName: string | null;
  sourcePages?: number[];
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Task 16E-UI: Penampil Dokumen PDF Berdampingan (Split-Pane Reader)
 *
 * Menampilkan berkas PDF asli dari bucket privat Supabase Storage menggunakan signed URL.
 * Membantu pembelajar meninjau teks asli dan konteks materi bab secara berdampingan.
 * Mengikuti Aturan F: Strict Vector Iconography (Zero Keyboard Emoji).
 */
export default function PdfViewerPane({
  sourceFilePath,
  sourceFileName,
  sourcePages = [],
  isOpen,
  onClose,
}: PdfViewerPaneProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function fetchSignedUrl() {
      if (!sourceFilePath || !isOpen) {
        setSignedUrl(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/courses/document-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: sourceFilePath }),
        });

        const data = await res.json();
        if (isCancelled) return;

        if (!res.ok || !data.signedUrl) {
          setError(data.error || "Gagal memuat dokumen PDF. Pastikan sesi login aktif.");
          setSignedUrl(null);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || "Koneksi terputus saat mengambil dokumen.");
          setSignedUrl(null);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    fetchSignedUrl();

    return () => {
      isCancelled = true;
    };
  }, [sourceFilePath, isOpen]);

  if (!isOpen) return null;

  const initialPage = sourcePages.length > 0 ? sourcePages[0] : 1;
  const pageLabel =
    sourcePages.length > 1
      ? `Halaman ${sourcePages[0]} - ${sourcePages[sourcePages.length - 1]}`
      : sourcePages.length === 1
      ? `Halaman ${sourcePages[0]}`
      : "Dokumen Sumber";

  return (
    <aside
      className="flex flex-col h-[750px] lg:h-full w-full rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden transition-all duration-300"
      aria-label="Penampil Dokumen PDF Pendukung"
    >
      {/* Header Penampil PDF */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
            <i className="bi bi-file-earmark-pdf-fill text-base"></i>
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-800">
              {sourceFileName || "Dokumen Referensi PDF"}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700 border border-sky-100 font-semibold">
                <i className="bi bi-bookmark-fill text-[9px] text-sky-500"></i>
                <span>{pageLabel}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition"
              title="Buka dokumen di tab baru"
            >
              <i className="bi bi-box-arrow-up-right text-xs"></i>
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-100 hover:text-rose-700 transition"
            title="Tutup penampil dokumen"
          >
            <i className="bi bi-x-lg text-xs"></i>
          </button>
        </div>
      </div>

      {/* Konten PDF / Status Pemanggilan */}
      <div className="relative flex-1 bg-slate-100">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs p-6 text-center">
            <i className="bi bi-hourglass-split text-3xl text-sky-500 animate-spin"></i>
            <p className="mt-3 text-xs font-semibold text-slate-700">
              Menyiapkan dokumen referensi...
            </p>
            <p className="text-[11px] text-slate-400">
              Menerbitkan token akses aman Supabase Storage
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-rose-50/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-2">
              <i className="bi bi-exclamation-triangle-fill text-lg"></i>
            </div>
            <p className="text-xs font-bold text-rose-800">Gagal Membuka Dokumen</p>
            <p className="mt-1 text-xs text-rose-600 max-w-xs">{error}</p>
            <button
              type="button"
              onClick={() => {
                const prev = sourceFilePath;
                setSignedUrl(null);
                setTimeout(() => {
                  if (prev) setSignedUrl(null);
                }, 100);
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
            >
              <i className="bi bi-arrow-clockwise"></i>
              <span>Coba Lagi</span>
            </button>
          </div>
        )}

        {signedUrl && !loading && (
          <iframe
            src={`${signedUrl}#page=${initialPage}&toolbar=1&navpanes=0`}
            className="w-full h-full border-0"
            title="Pratinjau Dokumen Referensi PDF"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        )}

        {!signedUrl && !loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <i className="bi bi-file-earmark-text text-3xl mb-2 text-slate-300"></i>
            <p className="text-xs font-medium">Dokumen sumber tidak tersedia untuk bab ini.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
