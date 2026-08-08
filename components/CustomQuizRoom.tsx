"use client";

import { useState } from "react";
import { KuisTab, NilaiTab, type AttemptRow, type QuizRow } from "@/components/LearnRoom";

// Ruang kuis kustom (Modul 10) — reuse KuisTab & NilaiTab dari ruang belajar.
export default function CustomQuizRoom({
  quiz,
  attempts,
  voiceLocked = false,
}: {
  quiz: QuizRow;
  attempts: AttemptRow[];
  voiceLocked?: boolean; // Fitur CD — paket belum mencakup jawab-suara
}) {
  const [tab, setTab] = useState<"kuis" | "nilai">("kuis");

  return (
    <div>
      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1.5">
        {(
          [
            { key: "kuis", label: "✏ Kerjakan Kuis" },
            { key: "nilai", label: "🏆 Nilai & Koreksi" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              tab === t.key
                ? "bg-white text-brand-600 shadow-card"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "kuis" ? (
          <KuisTab quiz={quiz} onFinished={() => setTab("nilai")} voiceLocked={voiceLocked} />
        ) : (
          <NilaiTab quiz={quiz} attempts={attempts} />
        )}
      </div>
    </div>
  );
}
