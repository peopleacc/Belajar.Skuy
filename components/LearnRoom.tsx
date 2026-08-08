"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SectionRenderer, {
  MathText,
  CodeBlock,
  OverviewRenderer,
} from "@/components/SectionRenderer";
import VideoSupport from "@/components/VideoSupport";
import ReferencesSection from "@/components/ReferencesSection";
import VoiceAnswer from "@/components/VoiceAnswer";
import LearningPathDrawer, { type DrawerChapter } from "@/components/LearningPathDrawer";
import {
  GenerateSettingsFields,
  GenerateSettingsModal,
  DEFAULT_OPTIONS,
  loadSavedOptions,
  saveOptions,
  type GenerateOptions,
} from "@/components/GenerateSettings";
import { adaptContent, buildMateriSteps } from "@/lib/content";

export type ContentRow = {
  id: string;
  title: string;
  chapter_number: number;
  // Bentuk body bervariasi (rekursif baru / flat lama) — dinormalkan oleh adaptContent().
  body: Record<string, unknown> | null;
  youtube_url: string | null;
  image_url: string | null;
};

// Fitur Q — soal PG atau esai, dibedakan `type` (absen = mcq, data lama pra-Fitur Q).
export type McqQuestion = {
  type?: "mcq";
  question_number: number;
  question_text: string;
  code_snippet?: string | null; // Fitur G — kode konteks soal (opsional)
  options: { A: string; B: string; C: string; D: string };
  correct_answer: "A" | "B" | "C" | "D";
  explanation: string;
};

export type EssayQuestion = {
  type: "essay";
  answer_mode?: "text" | "voice"; // Fitur R (esai suara) — belum ada UI rekam di batch ini
  question_number: number;
  question_text: string;
  code_snippet?: string | null;
  explanation: string;
  // key_points/model_answer SENGAJA tidak ada di tipe ini — sudah difilter di server
  // (stripEssaySecrets) sebelum sampai ke client, lihat next/lib/quiz.ts.
};

export type Question = McqQuestion | EssayQuestion;

function isEssay(q: Question): q is EssayQuestion {
  return q.type === "essay";
}

function wordCount(text: string) {
  const t = text.trim();
  return t.length === 0 ? 0 : t.split(/\s+/).length;
}

const MIN_ESSAY_WORDS = 15;

function hasCode(code?: string | null): code is string {
  return typeof code === "string" && code.trim().length > 0;
}

export type QuizRow = { id: string; questions: Question[] };

// Fitur Q — jawaban tersimpan per soal. String polos = data LAMA (pra-Fitur Q, huruf jawaban PG).
export type StoredAnswer =
  | { type: "mcq"; choice: string }
  | {
      type: "essay";
      text: string;
      score: number;
      feedback: string;
      matched_points?: string[];
      missing_points?: string[];
    };

export type AttemptRow = {
  id: string;
  score: number;
  answers: Record<string, StoredAnswer | string>;
  submitted_at: string;
};

/** Adaptasi jawaban tersimpan: data lama (string huruf PG) dibaca sebagai objek mcq. */
function normalizeStoredAnswer(raw: StoredAnswer | string | undefined): StoredAnswer {
  if (raw && typeof raw === "object" && "type" in raw) return raw;
  return { type: "mcq", choice: typeof raw === "string" ? raw : "" };
}

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

// ============ Generate materi (bab masih pending) ============

function GeneratePanel({
  contentId,
  voiceLocked = false,
}: {
  contentId: string;
  voiceLocked?: boolean; // Fitur CD
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [options, setOptions] = useState<GenerateOptions>(DEFAULT_OPTIONS);

  // Fitur M — muat pilihan terakhir dari pintu manapun (localStorage). useEffect (bukan lazy
  // useState) supaya tidak ada mismatch SSR/CSR — modalnya sendiri tetap tidak ikut ke-SSR.
  useEffect(() => {
    setOptions(loadSavedOptions());
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chapters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, options }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal generate materi. Coba lagi ya.");
        setLoading(false);
        return;
      }
      saveOptions(options);
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server. Coba lagi ya.");
      setLoading(false);
    }
  }

  return (
    <div className="relative rounded-sm border-2 border-dashed border-brand-200 bg-brand-50/50 px-6 py-10 text-center">
      {/* Fitur W — gerigi di POJOK KANAN ATAS (icon-only), bukan lagi teks di tengah alur baca.
          Konsisten dengan tombol gerigi di kartu bab (CourseChapters). */}
      <button
        type="button"
        onClick={() => setShowSettings((s) => !s)}
        disabled={loading}
        title="Pengaturan generate bab"
        aria-label="Pengaturan generate bab"
        aria-expanded={showSettings}
        className={`absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-50 ${
          showSettings
            ? "border-brand-300 bg-brand-50 text-brand-600"
            : "border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-600"
        }`}
      >
        <i className="bi bi-gear-fill text-xs"></i>
      </button>

      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl shadow-card">
        ✨
      </div>
      <p className="font-semibold text-slate-700">Materi bab ini belum digenerate</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
        AI akan menyusun materi bertahap, ringkasan, dan referensi untuk bab ini. Soal ujian dibuat
        belakangan dari materi ini, saat kamu masuk tahap Ujian.
      </p>

      {showSettings && (
        <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-brand-100 bg-white p-4 text-left shadow-card">
          <GenerateSettingsFields
            value={options}
            onChange={setOptions}
            disabled={loading}
            voiceLocked={voiceLocked}
          />
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mt-5 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 disabled:opacity-60"
      >
        {loading ? (
          "⏳ AI sedang menyusun materi... (±30 detik)"
        ) : showSettings ? (
          <>
            <i className="bi bi-lightning-charge-fill mr-1"></i> Generate dengan Pengaturan Ini
          </>
        ) : (
          <>
            <i className="bi bi-lightning-charge-fill mr-1"></i> Generate Materi Bab Ini
          </>
        )}
      </button>
      {error && (
        <p className="mx-auto mt-4 max-w-sm rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

// ============ Kuis Interaktif (dipakai sbg step "Ujian" & kuis kustom) ============

export function KuisTab({
  quiz,
  contentId,
  onFinished,
  onPassed,
  voiceLocked = false,
}: {
  quiz: QuizRow;
  contentId?: string; // kosong = kuis kustom (tanpa reset kuota chatbot)
  onFinished: () => void;
  onPassed?: () => void; // Fitur E — dipanggil saat kuis LULUS (untuk tandai bab selesai)
  // Fitur CD — paket user belum mencakup jawab-suara. Hanya mengunci tampilan;
  // penolakan sesungguhnya tetap di Express.
  voiceLocked?: boolean;
}) {
  const router = useRouter();
  const questions = quiz.questions;
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    score: number;
    correctCount: number;
    total: number;
    passed: boolean;
  } | null>(null);

  const q = questions[current];
  const hasEssay = questions.some(isEssay);

  function isAnswered(question: Question) {
    const raw = answers[String(question.question_number)];
    if (!raw) return false;
    return isEssay(question) ? wordCount(raw) >= MIN_ESSAY_WORDS : true;
  }
  const answeredCount = questions.filter(isAnswered).length;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id, contentId, answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal submit kuis. Coba lagi ya.");
        setSubmitting(false);
        return;
      }
      setResult(data);
      setSubmitting(false);
      if (data.passed) onPassed?.();
      router.refresh(); // refresh data attempts di tab Nilai
    } catch {
      setError("Tidak bisa terhubung ke server. Coba lagi ya.");
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-sm bg-white p-10 text-center shadow-card">
        <p className="text-5xl">{result.passed ? "🎉" : "💪"}</p>
        <h3 className="mt-3 text-2xl font-bold">
          Skor kamu:{" "}
          <span className={result.passed ? "text-emerald-500" : "text-rose-500"}>
            {result.score}
          </span>
          /100
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {hasEssay
            ? "Skor gabungan dari seluruh soal (pilihan ganda dinilai otomatis, esai dinilai AI)."
            : `${result.correctCount} dari ${result.total} soal benar.`}{" "}
          {result.passed
            ? contentId
              ? "Lulus! Kuota chat tutor AI bab ini di-reset. 🔓"
              : "Lulus! Kerja bagus. 🎉"
            : "Belum lulus (minimal 70) — pelajari koreksinya lalu coba lagi ya."}
        </p>
        <button
          onClick={onFinished}
          className="mt-6 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
        >
          {result.passed ? "Lanjut →" : "Lihat Koreksi →"}
        </button>
      </div>
    );
  }

  const completePct = Math.round(((current + 1) / questions.length) * 100);

  return (
    <div className="rounded-sm bg-white p-6 shadow-card md:p-8">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">
          Soal {current + 1} dari {questions.length}
        </span>
        <span className="text-[11px] font-semibold text-slate-400">{completePct}% Complete</span>
      </div>
      <div className="mb-6 h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
          style={{ width: `${completePct}%` }}
        />
      </div>

      <MathText className="text-lg font-bold leading-snug text-slate-900">
        {q.question_text}
      </MathText>

      {hasCode(q.code_snippet) && (
        <div className="mt-4">
          <CodeBlock code={q.code_snippet} />
        </div>
      )}

      {isEssay(q) ? (
        <div className="mt-5">
          {q.answer_mode === "voice" ? (
            <VoiceAnswer
              value={answers[String(q.question_number)] ?? ""}
              onChange={(text) =>
                setAnswers((a) => ({ ...a, [String(q.question_number)]: text }))
              }
              disabled={submitting}
              locked={voiceLocked}
            />
          ) : (
            <textarea
              value={answers[String(q.question_number)] ?? ""}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [String(q.question_number)]: e.target.value }))
              }
              rows={6}
              placeholder={`Tulis jawabanmu di sini (minimal ${MIN_ESSAY_WORDS} kata)...`}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          )}
          <p
            className={`mt-1 text-[11px] ${
              wordCount(answers[String(q.question_number)] ?? "") < MIN_ESSAY_WORDS
                ? "text-amber-500"
                : "text-slate-400"
            }`}
          >
            {wordCount(answers[String(q.question_number)] ?? "")} kata
            {wordCount(answers[String(q.question_number)] ?? "") < MIN_ESSAY_WORDS &&
              ` — minimal ${MIN_ESSAY_WORDS} kata`}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {OPTION_KEYS.map((key) => {
            const selected = answers[String(q.question_number)] === key;
            return (
              <button
                key={key}
                onClick={() =>
                  setAnswers((a) => ({ ...a, [String(q.question_number)]: key }))
                }
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition ${selected
                    ? "border-brand-500 bg-brand-50 text-slate-800 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50/40"
                  }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${selected
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-slate-200 bg-white text-slate-500"
                    }`}
                >
                  {key}
                </span>
                <span className="flex-1">
                  <MathText inline>{q.options[key]}</MathText>
                </span>
                {selected && (
                  <span className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[10px] text-light">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Expert Co-pilot Tip (strategi umum, bukan bocoran jawaban) */}
      <div className="mt-5 flex gap-3 rounded-2xl bg-brand-50 p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-sm text-white">
          ✦
        </span>
        <div>
          <p className="text-xs font-bold text-brand-700">Expert Co-pilot Tip</p>
          <p className="mt-0.5 text-xs leading-relaxed text-brand-900/70">
            {isEssay(q)
              ? q.answer_mode === "voice"
                ? "Jelaskan seolah-olah bercerita ke temanmu. Setelah rekaman selesai, transkripnya bisa kamu edit dulu sebelum submit."
                : "Jawab dengan kalimatmu sendiri, sebutkan poin-poin penting yang relevan dengan pertanyaan. Tidak perlu panjang — yang penting isinya tepat."
              : "Baca soal dengan teliti dan eliminasi pilihan yang jelas salah dulu. Kaitkan dengan materi bab yang baru kamu pelajari sebelum memilih."}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
        >
          ← Previous Question
        </button>
        {current < questions.length - 1 ? (
          <button
            onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
          >
            Next Question →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || answeredCount < questions.length}
            title={
              answeredCount < questions.length
                ? `Masih ada ${questions.length - answeredCount} soal belum dijawab`
                : undefined
            }
            className="rounded-xl bg-ink-900 px-5 py-2.5 text-xs font-semibold text-light transition hover:bg-ink-800 disabled:opacity-50"
          >
            {submitting ? (hasEssay ? "Menilai jawaban…" : "Mengirim...") : "Submit Quiz ✓"}
          </button>
        )}
      </div>
    </div>
  );
}

// ============ Nilai & Koreksi (dipakai di step Selesai & kuis kustom) ============

export function NilaiTab({ quiz, attempts }: { quiz: QuizRow; attempts: AttemptRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(attempts[0]?.id ?? null);
  const selected = attempts.find((a) => a.id === selectedId) ?? attempts[0] ?? null;

  if (attempts.length === 0) {
    return (
      <div className="rounded-sm border-2 border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
        <p className="text-2xl">📝</p>
        <p className="mt-2 font-semibold text-slate-700">Belum ada percobaan kuis</p>
        <p className="mt-1 text-sm text-slate-400">Kerjakan ujian bab ini dulu ya.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-sm bg-white p-6 shadow-card">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
          Riwayat Percobaan
        </h3>
        <div className="flex flex-wrap gap-2">
          {attempts.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${selected?.id === a.id
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
            >
              #{attempts.length - i} — {a.score}/100
              <span className="ml-2 font-normal opacity-70">
                {new Date(a.submitted_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <section className="space-y-3">
          {quiz.questions.map((q) => {
            const stored = normalizeStoredAnswer(selected.answers[String(q.question_number)]);

            // ============ Esai: skor 0-100, feedback AI, poin kunci ============
            if (isEssay(q)) {
              const essayStored =
                stored.type === "essay"
                  ? stored
                  : { type: "essay" as const, text: "", score: 0, feedback: "Belum dijawab." };
              const passed = essayStored.score >= 70;
              return (
                <div
                  key={q.question_number}
                  className={`rounded-2xl border-l-4 bg-white p-5 shadow-card ${passed ? "border-emerald-400" : "border-rose-400"
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <MathText className="text-sm font-semibold text-slate-800">
                        {`${q.question_number}. ${q.question_text}`}
                      </MathText>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${passed ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        }`}
                    >
                      {essayStored.score}/100
                    </span>
                  </div>
                  {hasCode(q.code_snippet) && (
                    <div className="mt-3">
                      <CodeBlock code={q.code_snippet} />
                    </div>
                  )}
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Jawabanmu {q.answer_mode === "voice" && "(dijawab dengan suara)"}
                    </p>
                    <p className="whitespace-pre-wrap text-xs text-slate-700">
                      {essayStored.text || "(kosong)"}
                    </p>
                  </div>
                  {essayStored.feedback && (
                    <div className="mt-2 rounded-lg bg-brand-50 px-3 py-2">
                      <p className="text-xs text-brand-700">💬 {essayStored.feedback}</p>
                    </div>
                  )}
                  {(essayStored.missing_points?.length ?? 0) > 0 && (
                    <p className="mt-2 text-[11px] text-amber-600">
                      Belum disinggung: {essayStored.missing_points!.join(", ")}
                    </p>
                  )}
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                    <MathText className="text-xs text-slate-600">{`💡 ${q.explanation}`}</MathText>
                  </div>
                </div>
              );
            }

            // ============ Pilihan ganda: benar/salah seperti sebelumnya ============
            const userAnswer = stored.type === "mcq" ? stored.choice : "";
            const correct = userAnswer === q.correct_answer;
            return (
              <div
                key={q.question_number}
                className={`rounded-2xl border-l-4 bg-white p-5 shadow-card ${correct ? "border-emerald-400" : "border-rose-400"
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <MathText className="text-sm font-semibold text-slate-800">
                      {`${q.question_number}. ${q.question_text}`}
                    </MathText>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${correct
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-rose-50 text-rose-600"
                      }`}
                  >
                    {correct ? "Benar" : "Salah"}
                  </span>
                </div>
                {hasCode(q.code_snippet) && (
                  <div className="mt-3">
                    <CodeBlock code={q.code_snippet} />
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  Jawabanmu:{" "}
                  <span className={correct ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>
                    {userAnswer || "—"}
                  </span>
                  {!correct && (
                    <>
                      {" · "}Jawaban benar:{" "}
                      <span className="font-bold text-emerald-600">{q.correct_answer}</span>
                    </>
                  )}
                </p>
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                  <MathText className="text-xs text-slate-600">{`💡 ${q.explanation}`}</MathText>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

// ============ Stepper linear: Bagian 1..N → Ringkasan → Ujian → Selesai ============

type Phase = "section" | "summary" | "exam" | "done";

function LearningStepper({
  content,
  quiz: initialQuiz,
  attempts,
  initialStep,
  courseHref,
  chapters = [],
  voiceLocked = false,
}: {
  content: ContentRow;
  quiz: QuizRow | null;
  attempts: AttemptRow[];
  initialStep: number; // content_progress.current_step tersimpan (0 kalau belum ada)
  courseHref?: string; // tujuan tombol "Selesaikan Bab" (learning path course)
  chapters?: DrawerChapter[]; // Fitur Y — daftar bab se-course untuk drawer learning path
  voiceLocked?: boolean; // Fitur CD — paket belum mencakup jawab-suara
}) {
  const router = useRouter();
  const adapted = adaptContent(content.body);
  const { nodes, overview, summary, references } = adapted;
  const materiSteps = buildMateriSteps(adapted);
  const N = materiSteps.length; // jumlah langkah materi (overview + subbab tingkat atas)
  const totalSteps = N + 2; // materi + ringkasan + ujian

  const [pathOpen, setPathOpen] = useState(false); // Fitur Y — drawer learning path

  const quizStale = Boolean((content.body as { quiz_stale?: boolean } | null)?.quiz_stale);

  // Posisi awal dari progres tersimpan (jangan auto-buka "Selesai" saat resume)
  const startPos = Math.min(Math.max(0, initialStep), N + 1);
  const [pos, setPos] = useState(startPos); // 0..N-1 = langkah materi, N = ringkasan, N+1 = ujian
  const [phase, setPhase] = useState<Phase>(
    startPos < N ? "section" : startPos === N ? "summary" : "exam"
  );
  const [examPassed, setExamPassed] = useState(false); // apakah ujian bab ini sudah lulus
  const [retryKey, setRetryKey] = useState(0); // remount KuisTab saat ulangi ujian

  // Fitur J — soal digenerate LAZY (saat menuju ujian). quiz bisa null di awal.
  const [quiz, setQuiz] = useState<QuizRow | null>(initialQuiz);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  const ensureQuiz = useCallback(
    async (forceRegenerate = false) => {
      if (quizLoading) return;
      if (quiz && !forceRegenerate) return;
      setQuizLoading(true);
      setQuizError(null);
      try {
        const res = await fetch("/api/chapters/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentId: content.id, regenerate: forceRegenerate }),
        });
        const data = await res.json();
        if (!res.ok || !data.quiz) {
          setQuizError(data.error ?? "Gagal menyusun soal. Coba lagi ya.");
        } else {
          setQuiz(data.quiz as QuizRow);
          // Fitur P — regenerate manual: refresh supaya penanda quiz_stale di `content` hilang
          if (forceRegenerate) router.refresh();
        }
      } catch {
        setQuizError("Tidak bisa terhubung ke server. Coba lagi ya.");
      } finally {
        setQuizLoading(false);
      }
    },
    [quiz, quizLoading, content.id, router]
  );

  // Persist current_step ke server (silent; % course update saat halaman course dibuka lagi)
  const saveProgress = useCallback(
    (step: number) => {
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: content.id, step, totalSteps }),
      }).catch(() => { });
    },
    [content.id, totalSteps]
  );

  const displayedStep =
    phase === "done" ? totalSteps : phase === "exam" ? N + 1 : phase === "summary" ? N : pos;
  const percent = Math.round((displayedStep / totalSteps) * 100);

  // Judul & query video untuk subbab yang sedang dibuka (fase section)
  const curStep = pos < N ? materiSteps[pos] : null;
  const curIsOverview = curStep?.type === "overview";
  const curNode = curStep && curStep.type === "node" ? nodes[curStep.index] : null;
  const sectionTitle = curIsOverview ? "Pengantar" : curNode?.title ?? content.title;
  const stepBadge = curIsOverview ? "PENGANTAR" : `BAGIAN ${pos + 1}`;
  const videoQuery = curIsOverview
    ? content.title
    : `${content.title} ${curNode?.title ?? ""}`.trim();

  function goToSection(i: number) {
    setPos(i);
    setPhase("section");
  }

  function nextFromSection() {
    const completed = pos + 1; // section ke-(pos) selesai dibaca
    saveProgress(completed);
    if (pos < N - 1) {
      setPos(pos + 1);
    } else {
      setPhase("summary");
    }
  }

  function nextFromSummary() {
    saveProgress(N + 1); // ringkasan selesai
    setPhase("exam");
    ensureQuiz(); // Fitur J — generate soal saat menuju ujian
  }

  return (
    <div>
      {/* Fitur Y — pemicu drawer learning path (muncul dari sisi KIRI) */}
      {chapters.length > 0 && (
        <button
          type="button"
          onClick={() => setPathOpen(true)}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-card transition hover:border-brand-300 hover:text-brand-600"
        >
          <i className="bi bi-list"></i> Learning Path
        </button>
      )}

      <LearningPathDrawer
        open={pathOpen}
        onClose={() => setPathOpen(false)}
        chapters={chapters}
        currentChapterId={content.id}
        subSteps={materiSteps.map((s, i) =>
          s.type === "overview"
            ? { title: "Pengantar" }
            : { title: nodes[s.index]?.title ?? `Bagian ${i + 1}` }
        )}
        // -1 saat fase ringkasan/ujian/selesai → tidak ada langkah materi yang disorot
        currentStepIndex={phase === "section" ? pos : -1}
        onPickStep={goToSection}
      />

      {/* Progress bar bab (fase section pakai progress di sidebar + dots) */}
      {phase !== "section" && (
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Progress bab</span>
            <span>{percent}%</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Konten per fase */}
      {phase === "section" && curStep && (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Kolom utama: materi subbab */}
          <div className="space-y-5">
            {pos === 0 && content.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content.image_url}
                alt={`Ilustrasi: ${content.title}`}
                className="h-48 w-full rounded-sm object-cover shadow-card"
                loading="lazy"
              />
            )}
            <div className="rounded-sm bg-white p-6 shadow-card md:p-8">
              {/* Header judul per subbab */}
              <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-600">
                {stepBadge}
              </span>
              <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900">{sectionTitle}</h2>
              <div className="mt-4">
                {curIsOverview ? (
                  <OverviewRenderer overview={overview} />
                ) : (
                  curNode && <SectionRenderer node={curNode} hideTitle />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => goToSection(Math.max(0, pos - 1))}
                disabled={pos === 0}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
              >
                ← Back
              </button>
              <div className="flex items-center gap-1.5">
                {materiSteps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === pos ? "w-5 bg-brand-500" : "w-1.5 bg-slate-200"
                      }`}
                  />
                ))}
              </div>
              <button
                onClick={nextFromSection}
                className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
              >
                {pos < N - 1 ? "Next →" : "Ke Ringkasan →"}
              </button>
            </div>
          </div>

          {/* Sidebar: video pendukung, progress (tombol skip ke kuis dihapus — Fitur K) */}
          <aside className="space-y-4">
            <VideoSupport query={videoQuery} />

            <div className="rounded-sm bg-white p-4 shadow-card">
              <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Progress Bab</span>
                <span className="text-brand-500">{percent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </aside>
        </div>
      )}

      {phase === "summary" && (
        <div className="space-y-6">
          <div className="rounded-sm bg-white p-6 shadow-card md:p-8">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-emerald-600">
              📌 Ringkasan
            </h3>
            <MathText>{summary || "Ringkasan tidak tersedia untuk bab ini."}</MathText>
          </div>

          {/* Fitur H — daftar referensi di akhir (tersembunyi kalau kosong) */}
          <ReferencesSection references={references} />

          {content.youtube_url && (
            <a
              href={content.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-sm bg-secondary p-5 text-light shadow-card transition hover:opacity-95"
            >
              <div>
                <p className="text-sm font-bold">▶ Deep Dive: Video Pendukung</p>
                <p className="text-xs text-light-muted">Cari video YouTube yang relevan dengan bab ini</p>
              </div>
              <span className="text-lg">→</span>
            </a>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={() => goToSection(N - 1)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
            >
              ← Kembali ke Materi
            </button>
            <button
              onClick={nextFromSummary}
              className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
            >
              Lanjut ke Ujian →
            </button>
          </div>
        </div>
      )}

      {phase === "exam" && (
        <div className="space-y-4">
          {/* Balik ke materi/pembahasan dari halaman ujian */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPhase("summary")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
            >
              ← Kembali ke Pembahasan
            </button>
            <button
              onClick={() => goToSection(N - 1)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
            >
              ← Kembali ke Materi
            </button>
            <span className="ml-auto text-xs text-slate-400">Ujian bab</span>
          </div>

          {/* Fitur P — materi sempat direvisi lewat regenerate subbab: tawarkan soal baru */}
          {quiz && quizStale && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
              <span>
                ⚠ Materi bab ini sempat diperbarui — soal lama mungkin belum menyesuaikan.
              </span>
              <button
                type="button"
                onClick={() => ensureQuiz(true)}
                disabled={quizLoading}
                className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
              >
                ↻ Buat Soal Baru
              </button>
            </div>
          )}

          {quiz ? (
            <KuisTab
              key={retryKey}
              quiz={quiz}
              contentId={content.id}
              voiceLocked={voiceLocked}
              onPassed={() => {
                saveProgress(totalSteps);
                setExamPassed(true);
              }}
              onFinished={() => setPhase("done")}
            />
          ) : quizLoading ? (
            <div className="rounded-sm bg-white p-10 text-center shadow-card">
              <p className="text-3xl">✍️</p>
              <p className="mt-3 font-semibold text-slate-700">Menyusun soal ujian…</p>
              <p className="mt-1 text-sm text-slate-400">
                AI sedang membuat soal dari materi bab ini (±20 detik).
              </p>
            </div>
          ) : (
            <div className="rounded-sm bg-white p-10 text-center shadow-card">
              <p className="text-3xl">📝</p>
              <p className="mt-3 font-semibold text-slate-700">Soal ujian belum dibuat</p>
              {quizError && (
                <p className="mx-auto mt-2 max-w-sm rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {quizError}
                </p>
              )}
              <button
                onClick={() => ensureQuiz()}
                className="mt-4 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
              >
                {quizError ? "Coba Lagi" : "Buat Soal Ujian"}
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-6">
          {examPassed ? (
            <div className="rounded-sm bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-center text-white shadow-card">
              <p className="text-5xl">🏆</p>
              <h3 className="mt-3 text-2xl font-bold">Bab Selesai!</h3>
              <p className="mt-1 text-sm text-emerald-50">
                Kamu sudah menuntaskan materi dan lulus ujian bab ini. Babnya sekarang bertanda
                selesai di learning path.
              </p>
              {courseHref && (
                <Link
                  href={courseHref}
                  className="mt-5 inline-flex items-center justify-center rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  ✓ Selesaikan Bab & Kembali ke Course
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-sm bg-gradient-to-br from-amber-500 to-rose-500 p-8 text-center text-white shadow-card">
              <p className="text-5xl">💪</p>
              <h3 className="mt-3 text-2xl font-bold">Belum Lulus</h3>
              <p className="mt-1 text-sm text-amber-50">
                Skor minimal untuk menyelesaikan bab ini adalah 70. Pelajari koreksi di bawah,
                lalu ulangi ujiannya.
              </p>
              <button
                onClick={() => {
                  setRetryKey((k) => k + 1);
                  setPhase("exam");
                }}
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                ↻ Ulangi Ujian
              </button>
            </div>
          )}
          {quiz && <NilaiTab quiz={quiz} attempts={attempts} />}
        </div>
      )}
    </div>
  );
}

// ============ Shell ruang belajar ============

export default function LearnRoom({
  content,
  quiz,
  attempts,
  initialStep = 0,
  courseHref,
  chapters = [],
  voiceLocked = false,
}: {
  content: ContentRow;
  quiz: QuizRow | null;
  attempts: AttemptRow[];
  initialStep?: number;
  courseHref?: string;
  chapters?: DrawerChapter[]; // Fitur Y — daftar bab se-course untuk drawer learning path
  voiceLocked?: boolean; // Fitur CD — paket belum mencakup jawab-suara
}) {
  const router = useRouter();
  const generated =
    content.body != null &&
    (content.body as { status?: string }).status !== "pending";

  // Fitur X — generate ulang SATU BAB PENUH (mengganti regenerate per-subbab dari Fitur P).
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenOptions, setRegenOptions] = useState<GenerateOptions>(DEFAULT_OPTIONS);
  const [regenInstruction, setRegenInstruction] = useState("");
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  // Materi baru bisa punya jumlah subbab berbeda → posisi stepper lama tidak relevan lagi.
  // Ganti `key` memaksa LearningStepper remount dengan initialStep terbaru dari server (0).
  const [regenVersion, setRegenVersion] = useState(0);

  function openRegenerate() {
    setRegenOptions(loadSavedOptions());
    setRegenInstruction("");
    setRegenError(null);
    setRegenOpen(true);
  }

  async function runRegenerate() {
    setRegenBusy(true);
    setRegenError(null);
    try {
      const res = await fetch("/api/chapters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: content.id,
          options: regenOptions,
          regenerate: true,
          instruction: regenInstruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegenError(data.error ?? "Gagal menyusun ulang materi bab. Coba lagi ya.");
        setRegenBusy(false);
        return;
      }
      saveOptions(regenOptions);
      setRegenOpen(false);
      setRegenBusy(false);
      setRegenVersion((v) => v + 1);
      router.refresh();
    } catch {
      setRegenError("Tidak bisa terhubung ke server. Coba lagi ya.");
      setRegenBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">
            Memulai Mempelajari: {content.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Bab {content.chapter_number}</p>
        </div>

        {/* Fitur X — tombol generate ulang BAB di pojok kanan; hanya untuk bab yang sudah
            punya materi (bab pending cukup lewat GeneratePanel biasa). */}
        {generated && (
          <button
            type="button"
            onClick={openRegenerate}
            title="Generate ulang seluruh materi bab ini"
            className="shrink-0 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600"
          >
            ↻ Generate Ulang Bab
          </button>
        )}
      </div>

      <div className="mt-6">
        {!generated ? (
          <GeneratePanel contentId={content.id} voiceLocked={voiceLocked} />
        ) : (
          <LearningStepper
            key={`${content.id}:${regenVersion}`}
            content={content}
            quiz={quiz}
            attempts={attempts}
            initialStep={initialStep}
            courseHref={courseHref}
            chapters={chapters}
            voiceLocked={voiceLocked}
          />
        )}
      </div>

      {regenOpen && (
        <GenerateSettingsModal
          title="↻ Generate Ulang Bab"
          subtitle={`Bab ${content.chapter_number}: ${content.title}`}
          voiceLocked={voiceLocked}
          value={regenOptions}
          onChange={setRegenOptions}
          busy={regenBusy}
          error={regenError}
          onCancel={() => setRegenOpen(false)}
          onSubmit={runRegenerate}
          submitLabel="↻ Generate Ulang"
          busyLabel="⏳ Menulis ulang materi…"
          extraContent={
            <>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Permintaan tambahan (opsional)
              </label>
              <textarea
                value={regenInstruction}
                onChange={(e) => setRegenInstruction(e.target.value)}
                rows={3}
                maxLength={500}
                disabled={regenBusy}
                placeholder="mis. fokus lebih ke praktik, tambah lebih banyak contoh soal, pakai bahasa lebih sederhana..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:bg-white disabled:opacity-60"
              />
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                ⚠ Seluruh materi bab ini akan ditulis ulang dan progres membacamu kembali ke awal.
                Status bab &amp; nilai kuismu tidak dihapus.
              </p>
            </>
          }
        />
      )}
    </div>
  );
}
