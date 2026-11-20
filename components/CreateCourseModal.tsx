"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import TopicSuggestions from "@/components/TopicSuggestions";
import QuotaExceededModal, { isQuotaError, type QuotaModalState } from "@/components/QuotaExceededModal";

export type CreateCourseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  ownedTitles?: string[];
  initialTab?: "topic" | "pdf";
};

/**
 * Task 16E-UI: Modal Pembuatan Kursus Terpadu (Topik AI & Unggah PDF)
 *
 * Mendukung alur generasi kurikulum fleksibel:
 * 1. Tab Topik: Generasi berdasarkan prompt teks / rekomendasi topik.
 * 2. Tab Dokumen PDF: Drag-and-drop berkas PDF, validasi ukuran 15MB, dan pembuatan silabus grounded.
 * Mengikuti Aturan F: Strict Vector Iconography (Zero Keyboard Emoji).
 */
export default function CreateCourseModal({
  isOpen,
  onClose,
  ownedTitles = [],
  initialTab = "topic",
}: CreateCourseModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"topic" | "pdf">(initialTab);
  const [topic, setTopic] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [customFocus, setCustomFocus] = useState("");
  const [language, setLanguage] = useState<"id" | "en">("id");

  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [quotaModal, setQuotaModal] = useState<QuotaModalState>({ isOpen: false });

  if (!isOpen) return null;

  function resetState() {
    setTopic("");
    setPdfFile(null);
    setCustomFocus("");
    setError(null);
    setStatusMessage(null);
    setSuggestions([]);
  }

  function handleClose() {
    if (loading) return;
    resetState();
    onClose();
  }

  function handleFileSelection(file: File) {
    setError(null);
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Format berkas tidak didukung. Harap unggah dokumen berekstensi .pdf asli.");
      return;
    }

    const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
    if (file.size > MAX_SIZE) {
      setError(`Ukuran berkas (${(file.size / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimal 15 MB.`);
      return;
    }

    setPdfFile(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  }

  async function handleSubmit() {
    setError(null);

    if (activeTab === "topic") {
      if (topic.trim().length < 3) {
        setError("Tuliskan topik kursus yang ingin dipelajari (minimal 3 karakter).");
        return;
      }

      setLoading(true);
      setStatusMessage("AI sedang merancang silabus kursus untukmu...");

      try {
        const res = await fetch("/api/courses/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: topic.trim(), language }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (isQuotaError(res.status, data)) {
            setQuotaModal({
              isOpen: true,
              message: data.error,
              featureName: "Generate Course",
              targetPlan: "premium",
              quota: data.quota ?? null,
            });
          }
          if (res.status === 422 && Array.isArray(data.suggestions)) {
            setSuggestions(data.suggestions);
          }
          setError(data.error || "Gagal menyusun kurikulum. Coba lagi ya.");
          setLoading(false);
          setStatusMessage(null);
          return;
        }

        setStatusMessage(`Kurikulum "${data.module.title}" berhasil dibuat!`);
        setTimeout(() => {
          handleClose();
          router.push(`/dashboard/courses/${data.module.id}`);
          router.refresh();
        }, 500);
      } catch {
        setError("Tidak dapat terhubung ke server. Pastikan koneksi internet stabil.");
        setLoading(false);
        setStatusMessage(null);
      }
    } else {
      // Tab PDF Mode
      if (!pdfFile) {
        setError("Silakan pilih atau seret berkas PDF dokumen terlebih dahulu.");
        return;
      }

      setLoading(true);
      setStatusMessage("Mengekstrak teks, sanitasi keamanan & menyusun kurikulum dari PDF...");

      try {
        const formData = new FormData();
        formData.append("file", pdfFile);
        if (customFocus.trim()) {
          formData.append("topic", customFocus.trim());
        }
        formData.append("language", language);

        const res = await fetch("/api/courses/generate", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          if (isQuotaError(res.status, data)) {
            setQuotaModal({
              isOpen: true,
              message: data.error,
              featureName: "Generate Course dari PDF",
              targetPlan: "premium",
              quota: data.quota ?? null,
            });
          }
          if (res.status === 422 && Array.isArray(data.suggestions)) {
            setSuggestions(data.suggestions);
          }
          setError(data.error || "Gagal memproses dokumen PDF untuk kurikulum.");
          setLoading(false);
          setStatusMessage(null);
          return;
        }

        setStatusMessage(`Kursus berbasis dokumen "${data.module.title}" berhasil dibuat!`);
        setTimeout(() => {
          handleClose();
          router.push(`/dashboard/courses/${data.module.id}`);
          router.refresh();
        }, 500);
      } catch {
        setError("Gagal mengunggah dokumen ke server. Coba beberapa saat lagi.");
        setLoading(false);
        setStatusMessage(null);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 md:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header Modal */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <i className="bi bi-sparkles text-brand-500"></i>
              <span>Buat Kursus Pembelajaran Baru</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Pilih cara belajar yang kamu inginkan: tentukan topik bebas atau unggah dokumen modul PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <i className="bi bi-x-lg text-sm"></i>
          </button>
        </div>

        {/* Tab Navigasi */}
        <div className="mt-6 flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("topic");
              setError(null);
            }}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition ${
              activeTab === "topic"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className="bi bi-lightbulb text-sm"></i>
            <span>Topik Bebas AI</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("pdf");
              setError(null);
            }}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition ${
              activeTab === "pdf"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className="bi bi-file-earmark-pdf-fill text-sm text-rose-500"></i>
            <span>Unggah Dokumen PDF</span>
          </button>
        </div>

        {/* Form Body: Tab Topik */}
        {activeTab === "topic" && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Topik atau Tujuan Pembelajaran
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
                rows={3}
                placeholder="Contoh: Belajar Next.js App Router, Server Components & Suspense dari dasar..."
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <TopicSuggestions
              ownedTitles={ownedTitles}
              onPick={(picked) => {
                setTopic(picked);
                setError(null);
              }}
            />
          </div>
        )}

        {/* Form Body: Tab Dokumen PDF */}
        {activeTab === "pdf" && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Dokumen Modul / Buku / Materi Belajar (Format PDF)
              </label>
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !loading && fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition ${
                  isDragging
                    ? "border-brand-500 bg-brand-50/50"
                    : pdfFile
                    ? "border-emerald-400 bg-emerald-50/30"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100/70"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={onFileInputChange}
                  disabled={loading}
                  className="hidden"
                />

                {pdfFile ? (
                  <div className="flex items-center gap-3 text-left">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                      <i className="bi bi-file-earmark-pdf-fill text-2xl"></i>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 truncate max-w-xs md:max-w-md">
                        {pdfFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB • Berkas siap diproses
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPdfFile(null);
                      }}
                      className="ml-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
                      title="Ganti berkas"
                    >
                      <i className="bi bi-arrow-repeat text-sm"></i>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs text-brand-500 mb-2 border border-slate-100">
                      <i className="bi bi-cloud-arrow-up text-2xl"></i>
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      Klik untuk memilih berkas atau seret berkas PDF ke sini
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Maksimal 15 MB (maks. 100 halaman). Dilindungi sanitizer Anti-XSS.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fokus Bahasan Khusus (Opsional)
              </label>
              <input
                type="text"
                value={customFocus}
                onChange={(e) => setCustomFocus(e.target.value)}
                disabled={loading}
                placeholder="Misal: Prioritaskan bab arsitektur dan studi kasus praktis..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>
          </div>
        )}

        {/* Pilihan Bahasa */}
        <div className="mt-5 flex items-center gap-2 pt-4 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-600">Bahasa Materi:</span>
          {(
            [
              { value: "id", label: "Bahasa Indonesia" },
              { value: "en", label: "English" },
            ] as const
          ).map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLanguage(l.value)}
              disabled={loading}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                language === l.value
                  ? "border-brand-500 bg-brand-50 text-brand-600"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Notifikasi Status & Error */}
        {statusMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-sky-50 px-4 py-2.5 text-xs font-medium text-sky-800 border border-sky-100">
            <i className="bi bi-hourglass-split animate-spin text-sky-600"></i>
            <span>{statusMessage}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            <div className="flex items-start gap-2">
              <i className="bi bi-exclamation-triangle-fill text-rose-500 shrink-0 mt-0.5"></i>
              <div className="flex-1 font-semibold">{error}</div>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-rose-200/60">
                <p className="font-semibold text-rose-800 text-[11px] mb-1.5 flex items-center gap-1">
                  <i className="bi bi-lightbulb-fill text-amber-500"></i>
                  <span>Saran topik alternatif yang relevan:</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTopic(s);
                        setError(null);
                        setSuggestions([]);
                      }}
                      className="rounded-lg bg-white border border-rose-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600 active:scale-95 transition disabled:opacity-60"
          >
            {loading ? (
              <>
                <i className="bi bi-hourglass-split animate-spin"></i>
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <i className="bi bi-lightning-charge-fill"></i>
                <span>{activeTab === "pdf" ? "Proses & Buat Kursus" : "Generate Kursus"}</span>
              </>
            )}
          </button>
        </div>

        {/* Modal Kuota */}
        <QuotaExceededModal
          isOpen={quotaModal.isOpen}
          onClose={() => setQuotaModal({ isOpen: false })}
          title={quotaModal.title}
          message={quotaModal.message}
          featureName={quotaModal.featureName}
          targetPlan={quotaModal.targetPlan}
          quota={quotaModal.quota}
        />
      </div>
    </div>
  );
}
