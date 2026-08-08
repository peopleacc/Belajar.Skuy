"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopicSuggestions from "@/components/TopicSuggestions";

// CTA "Buat Materi Baru" → POST /api/courses/generate → Express → AI provider (Modul 4).
export default function NewCourseCard({ ownedTitles = [] }: { ownedTitles?: string[] }) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [topic, setTopic] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Fitur DN — bahasa keluaran course. Tombol EKSPLISIT, bukan deteksi otomatis
  // dari topik: topik pendek yang sama di dua bahasa ("Python", "AI", "React")
  // gampang salah tebak, dan user tidak punya cara mengoreksinya.
  // Ditetapkan sekali di sini lalu disimpan di modul — semua bab & kuis
  // berikutnya mengikutinya, jadi satu course tidak campur bahasa.
  const [language, setLanguage] = useState<"id" | "en">("id");

  // Fitur O — klik chip rekomendasi mengisi textarea (tidak langsung generate), boleh diedit dulu.
  function handlePickTopic(title: string) {
    setTopic(title);
    setError(null);
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleGenerate() {
    if (topic.trim().length < 3) {
      setError("Tulis dulu topik yang ingin dipelajari ya 🙂");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice("✨ AI sedang menyusun kurikulum untukmu... (±15 detik)");

    try {
      const res = await fetch("/api/courses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, language }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Gagal generate kurikulum. Coba lagi ya.");
        setNotice(null);
        setLoading(false);
        return;
      }

      setNotice(`✅ Kurikulum "${data.module.title}" berhasil dibuat!`);
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

      {/* Fitur DN — bahasa materi yang akan digenerate. Ditetapkan SEKALI di sini;
          semua bab & kuis course ini nanti mengikutinya, jadi tidak campur bahasa. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">Bahasa materi:</span>
        {([
          { value: "id", label: "🇮🇩 Indonesia" },
          { value: "en", label: "🇬🇧 English" },
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
        <a
          href="/dashboard/quizzes"
          className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
          title="Bikin kuis kustom dari teks atau PDF"
        >
          ⬆ Upload Materi (PDF → Kuis)
        </a>
        <a
          href="/dashboard/quizzes"
          className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
          title="Bikin kuis kustom dari teks materi"
        >
          <i className="bi bi-pencil-square"></i> Bikin Quiz Kustom
        </a>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="ml-auto rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 disabled:opacity-60"
        >
          {loading ? (
            "⏳ Menyusun..."
          ) : (
            <>
              <i className="bi bi-lightning-charge-fill mr-1"></i> Generate Course
            </>
          )}
        </button>
      </div>

      <TopicSuggestions ownedTitles={ownedTitles} onPick={handlePickTopic} />

      {notice && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{notice}</p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
      )}
    </section>
  );
}
