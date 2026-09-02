"use client";

import { useCallback, useEffect, useState } from "react";
import { pickSuggestions, type TopicSuggestion } from "@/lib/topicSuggestions";
import TopicCategoryModal from "@/components/TopicCategoryModal";

// Fitur V — chip rekomendasi topik di bawah tombol Generate Course. STATIS TOTAL: tidak ada
// panggilan jaringan/AI sama sekali (menggantikan Fitur O yang lewat Express → AI → Redis).
export default function TopicSuggestions({
  ownedTitles,
  onPick,
}: {
  ownedTitles: string[];
  onPick: (title: string) => void;
}) {
  const [topics, setTopics] = useState<TopicSuggestion[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Randomisasi WAJIB di useEffect (bukan saat render/lazy useState) — kalau tidak, server
  // merender satu urutan dan client mengocok urutan lain → hydration mismatch.
  const shuffle = useCallback(() => {
    setTopics(pickSuggestions(ownedTitles));
  }, [ownedTitles]);

  useEffect(() => {
    shuffle();
  }, [shuffle]);

  if (topics.length === 0) return null; // render pertama (server & hidrasi awal)

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500">✨ Rekomendasi buat kamu</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1 text-xs font-semibold text-brand-600 transition hover:text-brand-700 hover:underline dark:text-brand-400"
          >
            <i className="bi bi-grid-fill"></i>
            <span>📂 Jelajahi Kategori</span>
          </button>
          <button
            type="button"
            onClick={shuffle}
            className="text-xs font-semibold text-slate-400 transition hover:text-slate-600 hover:underline dark:hover:text-slate-200"
          >
            ↻ Ganti
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {topics.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.reason}
            onClick={() => onPick(t.title)}
            className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-left text-xs transition hover:border-brand-300 hover:bg-brand-50/50"
          >
            <p className="font-semibold text-slate-700">{t.title}</p>
            <p className="mt-0.5 line-clamp-1 text-slate-400">{t.reason}</p>
          </button>
        ))}
      </div>

      {/* Modal Dialog Eksplorasi Rekomendasi Topik Berklasifikasi */}
      <TopicCategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPick={onPick}
      />
    </div>
  );
}

