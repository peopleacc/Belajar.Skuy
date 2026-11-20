"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopicSuggestions from "@/components/TopicSuggestions";
import QuotaExceededModal, { isQuotaError, type QuotaModalState } from "@/components/QuotaExceededModal";
import CreateCourseModal from "@/components/CreateCourseModal";

// CTA "Buat Materi Baru" → POST /api/courses/generate → Express → AI provider (Modul 4).
export default function NewCourseCard({ ownedTitles = [] }: { ownedTitles?: string[] }) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [topic, setTopic] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quotaModal, setQuotaModal] = useState<QuotaModalState>({ isOpen: false });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Fitur DN — bahasa keluaran course. Tombol EKSPLISIT, bukan deteksi otomatis
  // dari topik: topik pendek yang sama di dua bahasa ("Python", "AI", "React")
  // gampang salah tebak, dan user tidak punya cara mengoreksinya.
  const [language, setLanguage] = useState<"id" | "en">("id");

  // Fitur O — klik chip rekomendasi mengisi textarea (tidak langsung generate), boleh diedit dulu.
  function handlePickTopic(title: string) {
    setTopic(title);
    setError(null);
    setSuggestions([]);
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleGenerate() {
    if (topic.trim().length < 3) {
      setError("Tulis dulu topik yang ingin dipelajari ya.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice("AI sedang menyusun kurikulum untukmu... (±15 detik)");

    try {
      const res = await fetch("/api/courses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, language }),
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
        if (res.status === 422 && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        } else {
          setSuggestions([]);
        }
        setError(data.error ?? "Gagal generate kurikulum. Coba lagi ya.");
        setNotice(null);
        setLoading(false);
        return;
      }

      setNotice(`Kurikulum "${data.module.title}" berhasil dibuat!`);
      setTopic("");
      router.push(`/dashboard/courses/${data.module.id}`);
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server. Coba lagi ya.");
      setNotice(null);
      setLoading(false);
    }
  }

  return (
    <section className="rounded-sm bg-white p-6 shadow-card">
      <h2 className="text-lg font-bold">Membuat Materi Baru</h2>
      <p className="mt-1 text-sm text-slate-500">
        Topik apa yang ingin kamu kuasai hari ini? Tulis topik atau tujuan belajarmu,
        AI kami yang menyusun kurikulumnya.
      </p>

      <textarea
        ref={textareaRef}
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={3}
        disabled={loading}
        placeholder="Contoh: Dasar-dasar React untuk pemula, fokus ke hooks dan state management..."
        className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
      />

      {/* Fitur DN — bahasa materi yang akan digenerate */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">Bahasa materi:</span>
        {([
          { value: "id", label: "Indonesia" },
          { value: "en", label: "English" },
        ] as const).map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => setLanguage(l.value)}
            disabled={loading}
            className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition disabled:opacity-60 ${
              language === l.value
                ? "border-brand-500 bg-brand-500/10 text-brand-600"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPdfModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
          title="Unggah berkas PDF untuk membuat kursus pembelajaran baru"
        >
          <i className="bi bi-file-earmark-pdf-fill text-rose-500"></i>
          <span>Upload PDF (Kursus Baru)</span>
        </button>
        <a
          href="/dashboard/quizzes"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
          title="Bikin kuis kustom dari teks atau PDF"
        >
          <i className="bi bi-file-earmark-arrow-up text-brand-500"></i>
          <span>Upload Materi (PDF → Kuis)</span>
        </a>
        <a
          href="/dashboard/quizzes"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
          title="Bikin kuis kustom dari teks materi"
        >
          <i className="bi bi-pencil-square text-brand-500"></i>
          <span>Bikin Quiz Kustom</span>
        </a>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="ml-auto rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95 disabled:opacity-60 flex items-center gap-2"
        >
          {loading ? (
            <>
              <i className="bi bi-hourglass-split animate-spin"></i>
              <span>Menyusun…</span>
            </>
          ) : (
            <>
              <i className="bi bi-lightning-charge-fill"></i>
              <span>Generate Course</span>
            </>
          )}
        </button>
      </div>

      <TopicSuggestions ownedTitles={ownedTitles} onPick={handlePickTopic} />

      {notice && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-2 text-xs font-medium text-brand-700 border border-brand-100">
          <i className="bi bi-stars text-brand-600"></i>
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 border border-rose-200">
          <i className="bi bi-exclamation-triangle-fill text-rose-500 shrink-0 mt-0.5"></i>
          <div className="flex-1">
            <span className="font-semibold">{error}</span>
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
                      className="rounded-lg bg-white border border-rose-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/50 transition text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                  <i className="bi bi-shield-check text-emerald-600"></i>
                  <span>Kuota harian Anda tetap utuh karena topik belum diproses.</span>
                </p>
              </div>
            )}
            {isQuotaError(0, error) && (
              <button
                type="button"
                onClick={() =>
                  setQuotaModal({
                    isOpen: true,
                    message: error,
                    featureName: "Generate Course",
                    targetPlan: "premium",
                  })
                }
                className="mt-1.5 flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 hover:underline"
              >
                <span>Lihat Pilihan Paket & Upgrade</span>
                <i className="bi bi-arrow-right"></i>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal Kuota Habis & Pilihan Upgrade Premium */}
      <QuotaExceededModal
        isOpen={quotaModal.isOpen}
        onClose={() => setQuotaModal({ isOpen: false })}
        title={quotaModal.title}
        message={quotaModal.message}
        featureName={quotaModal.featureName}
        targetPlan={quotaModal.targetPlan}
        quota={quotaModal.quota}
      />

      {/* Modal Pembuatan Kursus Terpadu (Topik AI & Unggah PDF) */}
      <CreateCourseModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        ownedTitles={ownedTitles}
        initialTab="pdf"
      />
    </section>
  );
}
