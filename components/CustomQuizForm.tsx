"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  QuizTypeFields,
  rebalanceQuizTypes,
  enabledFromCounts,
  type QuizTypeCounts,
} from "@/components/GenerateSettings";

export type MaterialSource = {
  moduleId: string;
  moduleTitle: string;
  chapters: { id: string; number: number; title: string }[];
};

type SourceTab = "text" | "pdf" | "materials";
const MAX_CHAPTERS = 3;

// Form kuis kustom (Modul 10 + Fitur N): teks bebas, file PDF, ATAU bab course sendiri yang
// sudah digenerate (maks 3 bab, dari 1 course).
export default function CustomQuizForm({
  materialSources,
  voiceLocked = false,
}: {
  materialSources: MaterialSource[];
  voiceLocked?: boolean; // Fitur CD — paket belum mencakup soal jawab-suara
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<SourceTab>("text");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [quizTypes, setQuizTypes] = useState<QuizTypeCounts>({ mcq: 10, essay: 0, voice: 0 });
  const [selectedModuleId, setSelectedModuleId] = useState(materialSources[0]?.moduleId ?? "");
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedModule = useMemo(
    () => materialSources.find((m) => m.moduleId === selectedModuleId) ?? null,
    [materialSources, selectedModuleId]
  );

  function toggleChapter(id: string) {
    setSelectedChapterIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_CHAPTERS) return prev; // sudah maks 3, abaikan
      return [...prev, id];
    });
  }

  function changeModule(moduleId: string) {
    setSelectedModuleId(moduleId);
    setSelectedChapterIds([]); // ganti course → reset pilihan bab
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];

    if (tab === "materials" && selectedChapterIds.length === 0) {
      setError("Pilih minimal 1 bab ya.");
      return;
    }
    if (tab === "text" && !text.trim()) {
      setError("Isi teks materi dulu ya.");
      return;
    }
    if (tab === "pdf" && !file) {
      setError("Unggah file PDF dulu ya.");
      return;
    }

    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("questionCount", String(questionCount));
    form.append("quizTypes", JSON.stringify(quizTypes));
    if (tab === "materials") {
      form.append("contentIds", JSON.stringify(selectedChapterIds));
    } else if (tab === "text") {
      form.append("text", text);
    } else if (file) {
      form.append("file", file);
    }

    try {
      const res = await fetch("/api/quiz/custom", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat kuis. Coba lagi ya.");
        setLoading(false);
        return;
      }
      router.push(`/dashboard/quizzes/${data.quiz.id}`);
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server. Coba lagi ya.");
      setLoading(false);
    }
  }

  const TABS: { key: SourceTab; label: string }[] = [
    { key: "text", label: "📋 Teks" },
    { key: "pdf", label: "📄 PDF" },
    { key: "materials", label: "📚 Dari Materi Saya" },
  ];

  return (
    <form onSubmit={handleSubmit} className="rounded-sm bg-white p-6 shadow-card">
      <h2 className="text-lg font-bold">Bikin Quiz Kustom</h2>
      <p className="mt-1 text-sm text-slate-500">
        Tempel teks materi, unggah PDF, atau pilih bab dari course yang sudah kamu generate —
        AI membuat soal kuis dari sumber pilihanmu.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setError(null);
            }}
            className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              tab === t.key
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "text" && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          disabled={loading}
          placeholder="Tempel materi di sini (minimal 100 karakter)..."
          className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
        />
      )}

      {tab === "pdf" && (
        <div className="mt-4">
          <label className="inline-block cursor-pointer rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-xs font-medium text-slate-500 transition hover:border-brand-300 hover:bg-brand-50/50">
            📄 {fileName ?? "Pilih file PDF (maks 5MB)"}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={loading}
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
        </div>
      )}

      {tab === "materials" && (
        <div className="mt-4">
          {materialSources.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 px-4 py-6 text-center">
              <p className="text-sm font-medium text-slate-600">
                Belum ada materi yang digenerate.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Buat course dulu, generate minimal 1 bab, lalu kembali ke sini.
              </p>
              <a
                href="/dashboard/generate"
                className="mt-3 inline-block rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600"
              >
                + Generate Course
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <select
                value={selectedModuleId}
                onChange={(e) => changeModule(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white disabled:opacity-60"
              >
                {materialSources.map((m) => (
                  <option key={m.moduleId} value={m.moduleId}>
                    {m.moduleTitle}
                  </option>
                ))}
              </select>

              {selectedModule && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-400">
                    Pilih bab (maks {MAX_CHAPTERS}) — {selectedChapterIds.length}/{MAX_CHAPTERS}
                  </p>
                  {selectedModule.chapters.map((c) => {
                    const checked = selectedChapterIds.includes(c.id);
                    const disabledCheckbox =
                      !checked && selectedChapterIds.length >= MAX_CHAPTERS;
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition ${
                          checked
                            ? "border-brand-500 bg-brand-50"
                            : "border-slate-200 hover:bg-slate-50"
                        } ${disabledCheckbox ? "opacity-50" : "cursor-pointer"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={loading || disabledCheckbox}
                          onChange={() => toggleChapter(c.id)}
                          className="accent-brand-500"
                        />
                        <span className="text-slate-700">
                          Bab {c.number}: {c.title}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
          <span>Jumlah soal</span>
          <span className="text-brand-600">{questionCount}</span>
        </div>
        <input
          type="range"
          min={5}
          max={20}
          value={questionCount}
          disabled={loading}
          onChange={(e) => {
            const n = Number(e.target.value);
            setQuestionCount(n);
            // Fitur T — tipe yang aktif dipertahankan saat jumlah soal berubah.
            setQuizTypes((prev) => rebalanceQuizTypes(prev, n, enabledFromCounts(prev)));
          }}
          className="w-full accent-brand-500"
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>5</span>
          <span>20</span>
        </div>
      </div>

      <div className="mt-4">
        <QuizTypeFields
          total={questionCount}
          value={quizTypes}
          onChange={setQuizTypes}
          disabled={loading}
          voiceLocked={voiceLocked}
        />
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 disabled:opacity-60"
        >
          {loading ? (
            "⏳ AI menyusun soal..."
          ) : (
            <>
              <i className="bi bi-pencil-square mr-1"></i> Generate Kuis
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
      )}
    </form>
  );
}
