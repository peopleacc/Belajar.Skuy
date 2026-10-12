"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSessionRecorder } from "@/components/simulation/useSessionRecorder";
import { VoiceFrequency } from "@/components/simulation/VoiceFrequency";

/**
 * planning-update-15 — sesi simulasi wawancara BEBAS. Berbeda dari InterviewRunner
 * (interview kerja: posisi + level + deskripsi pekerjaan), di sini pengguna
 * memasukkan skenario wawancara lewat PROMPT DESKRIPSI (AI menyusun pertanyaan)
 * atau membuat DAFTAR PERTANYAAN SENDIRI (mode kustom).
 *
 * Mesin rekam/analisis/unggah SAMA PERSIS (useSessionRecorder); yang beda cuma
 * fase setup dan payload yang dikirim ke API.
 */

const MAX_ANSWER_SECONDS = 180; // 3 menit/jawaban
const CARD = "rounded-sm bg-white shadow-card";

type Phase = "setup" | "running" | "finishing";
type InputMode = "prompt" | "custom";

type QuestionMode = "text" | "text-voice" | "voice-only";
const QUESTION_MODES: { value: QuestionMode; label: string; icon: string }[] = [
  { value: "text", label: "Teks", icon: "📄" },
  { value: "text-voice", label: "Teks + Suara", icon: "🔊" },
  { value: "voice-only", label: "Suara saja", icon: "🎧" },
];

type SessionLang = "id" | "en";
const SESSION_LANGS: { value: SessionLang; label: string; speech: string }[] = [
  { value: "id", label: "🇮🇩 Suara Indonesia", speech: "id-ID" },
  { value: "en", label: "🇬🇧 Suara Inggris", speech: "en-US" },
];

export default function WawancaraRunner({
  historySlot,
}: {
  historySlot?: React.ReactNode;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("setup");
  const [inputMode, setInputMode] = useState<InputMode>("prompt");

  // ── Mode Prompt AI ──
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [questionCount, setQuestionCount] = useState(5);

  // ── Mode Pertanyaan Kustom ──
  const [customQuestions, setCustomQuestions] = useState<string[]>([""]);

  // ── Pengaturan umum ──
  const [wantVisual, setWantVisual] = useState(true);
  const [sessionLang, setSessionLang] = useState<SessionLang>("id");
  const [questionMode, setQuestionMode] = useState<QuestionMode>("text");

  const [questions, setQuestions] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startNote, setStartNote] = useState("");
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const supported = typeof window !== "undefined" && "speechSynthesis" in window;
    setTtsSupported(supported);
    if (!supported) return;

    function loadVoices() {
      voicesRef.current = window.speechSynthesis.getVoices();
    }
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!ttsSupported || !text) return;
      const speechLang =
        SESSION_LANGS.find((l) => l.value === sessionLang)?.speech ?? "id-ID";
      const prefix = speechLang.slice(0, 2).toLowerCase();

      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = speechLang;
      const match =
        voicesRef.current.find((v) => v.lang.toLowerCase() === speechLang.toLowerCase()) ??
        voicesRef.current.find((v) => v.lang.toLowerCase().startsWith(prefix));
      if (match) utter.voice = match;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    },
    [ttsSupported, sessionLang]
  );

  useEffect(() => {
    if (phase !== "running" || questionMode === "text") return;
    speak(questions[index] ?? "");
    return () => {
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, [index, questionMode, phase, questions, speak, ttsSupported]);

  const rec = useSessionRecorder({
    maxSegmentSeconds: MAX_ANSWER_SECONDS,
    wantVisual,
  });

  // Tandai 'abandoned' kalau tab ditutup di tengah sesi.
  useEffect(() => {
    function onPageHide() {
      if (phase === "running" && sessionIdRef.current) {
        navigator.sendBeacon(
          "/api/simulation/finish",
          new Blob(
            [JSON.stringify({ action: "abandon", sessionId: sessionIdRef.current })],
            { type: "application/json" }
          )
        );
      }
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [phase]);

  useEffect(() => {
    if (phase === "running" && previewRef.current && rec.camStreamRef.current) {
      previewRef.current.srcObject = rec.camStreamRef.current;
      void previewRef.current.play().catch(() => {});
    }
  }, [phase, rec.visualState, rec.camStreamRef]);

  // ── Helper pertanyaan kustom ──
  function addQuestion() {
    if (customQuestions.length >= 10) return;
    setCustomQuestions((prev) => [...prev, ""]);
  }
  function removeQuestion(i: number) {
    setCustomQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateQuestion(i: number, value: string) {
    setCustomQuestions((prev) => prev.map((q, idx) => (idx === i ? value : q)));
  }
  function moveQuestion(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= customQuestions.length) return;
    setCustomQuestions((prev) => {
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function start() {
    setError(null);

    // Validasi lokal
    if (title.trim().length < 3) {
      setError("Isi judul/topik wawancara (minimal 3 karakter).");
      return;
    }

    if (inputMode === "prompt") {
      if (promptText.trim().length < 10) {
        setError("Isi deskripsi wawancara (minimal 10 karakter).");
        return;
      }
    } else {
      const validQs = customQuestions.filter((q) => q.trim().length > 0);
      if (validQs.length === 0) {
        setError("Tambahkan minimal 1 pertanyaan.");
        return;
      }
    }

    setStarting(true);

    const { micOk, visualOk } = await rec.prepareMedia(setStartNote);

    try {
      setStartNote(
        inputMode === "prompt"
          ? "AI sedang menyusun pertanyaan…"
          : "Menyiapkan sesi…"
      );

      const context =
        inputMode === "prompt"
          ? {
              kind: "wawancara_prompt" as const,
              title: title.trim(),
              prompt: promptText.trim(),
              questionCount,
            }
          : {
              kind: "wawancara_custom" as const,
              title: title.trim(),
              questions: customQuestions.filter((q) => q.trim().length > 0),
            };

      const res = await fetch("/api/simulation/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "wawancara",
          context,
          settings: { language: sessionLang, noMic: !micOk, visualEnabled: visualOk },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat sesi.");
        rec.releaseMedia();
        return;
      }
      sessionIdRef.current = data.sessionId;

      // Pertanyaan — untuk mode kustom sudah dimiliki klien, tapi tetap ambil
      // dari server (dijamin bersih/divalidasi), pola yang sama dengan InterviewRunner.
      const qRes = await fetch(`/api/simulation/questions?sessionId=${data.sessionId}`);
      const qData = await qRes.json();
      if (!qRes.ok || !Array.isArray(qData.questions) || qData.questions.length === 0) {
        setError("Sesi dibuat tapi pertanyaannya gagal dimuat. Buka dari daftar sesi.");
        return;
      }
      setQuestions(qData.questions);
      setIndex(0);
      setPhase("running");
      rec.beginSegment();
    } catch {
      setError("Tidak bisa terhubung ke server. Coba lagi.");
      rec.releaseMedia();
    } finally {
      setStarting(false);
      setStartNote("");
    }
  }

  function nextQuestion() {
    rec.closeSegment(sessionIdRef.current ?? "", index);
    setIndex((i) => i + 1);
    rec.beginSegment();
  }

  async function finish() {
    setPhase("finishing");
    rec.closeSegment(sessionIdRef.current ?? "", index);
    await rec.finalize();
    try {
      await fetch("/api/simulation/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finish", sessionId: sessionIdRef.current }),
      });
      setScoring(true);
      await fetch("/api/simulation/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      }).catch(() => {});
    } catch {
      /* status tertinggal 'running' → daftar sesi yang menangani */
    }
    router.push(`/simulation/${sessionIdRef.current}`);
  }

  // ==== FASE SETUP ====
  if (phase === "setup") {
    const card = (
      <div className={`${CARD} p-8`}>
        <h1 className="text-2xl font-bold tracking-tight">Simulasi Wawancara</h1>
        <p className="mt-2 text-sm text-slate-500">
          Latihan wawancara bebas — masukkan skenario/topik wawancaramu, atau buat pertanyaanmu
          sendiri.
        </p>

        {/* ── Sakelar Mode ── */}
        <div className="mt-6 flex gap-2 rounded-xl border border-border bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setInputMode("prompt")}
            className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
              inputMode === "prompt"
                ? "bg-brand-500 text-white shadow-sm"
                : "text-slate-500 hover:bg-white"
            }`}
          >
            🤖 Prompt Deskripsi (AI)
          </button>
          <button
            type="button"
            onClick={() => setInputMode("custom")}
            className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
              inputMode === "custom"
                ? "bg-brand-500 text-white shadow-sm"
                : "text-slate-500 hover:bg-white"
            }`}
          >
            ✏️ Buat Pertanyaan Sendiri
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {/* ── Judul / Topik (kedua mode) ── */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Judul / Topik Wawancara
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Wawancara Beasiswa LPDP, Seleksi Organisasi BEM, dll."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white"
            />
          </div>

          {/* ── Konten per mode ── */}
          {inputMode === "prompt" ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Deskripsi Wawancara (Prompt)
                </label>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder="Jelaskan skenario wawancara secara mendalam: latar belakang, fokus penilaian, profil kandidat yang diharapkan, dsb. AI akan menyusun pertanyaan berdasarkan deskripsi ini…"
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white"
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
                  <span>Jumlah pertanyaan</span>
                  <span className="text-brand-600">{questionCount}</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-600">
                Daftar Pertanyaan ({customQuestions.length}/10)
              </label>
              <div className="space-y-2">
                {customQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-2.5 shrink-0 text-xs font-bold text-slate-400">
                      {i + 1}.
                    </span>
                    <input
                      value={q}
                      onChange={(e) => updateQuestion(i, e.target.value)}
                      placeholder={`Pertanyaan ke-${i + 1}`}
                      maxLength={500}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white"
                    />
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => moveQuestion(i, -1)}
                        disabled={i === 0}
                        className="rounded-lg border border-slate-200 p-1.5 text-xs text-slate-400 transition hover:bg-surface-2 disabled:opacity-30"
                        title="Pindah ke atas"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(i, 1)}
                        disabled={i === customQuestions.length - 1}
                        className="rounded-lg border border-slate-200 p-1.5 text-xs text-slate-400 transition hover:bg-surface-2 disabled:opacity-30"
                        title="Pindah ke bawah"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(i)}
                        disabled={customQuestions.length <= 1}
                        className="rounded-lg border border-rose-200 p-1.5 text-xs text-rose-400 transition hover:bg-rose-50 disabled:opacity-30"
                        title="Hapus pertanyaan"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {customQuestions.length < 10 && (
                <button
                  type="button"
                  onClick={addQuestion}
                  className="mt-3 flex items-center gap-1.5 rounded-xl border border-dashed border-brand-300 px-4 py-2 text-xs font-semibold text-brand-500 transition hover:bg-brand-50"
                >
                  <i className="bi bi-plus-circle" /> Tambah Pertanyaan
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Analisis Visual ── */}
        <label className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
          <input
            type="checkbox"
            checked={wantVisual}
            onChange={(e) => setWantVisual(e.target.checked)}
            className="mt-0.5 accent-brand-500"
          />
          <span className="text-xs leading-relaxed text-slate-600">
            <span className="font-semibold">Analisis penyampaian via kamera</span> — dianalisis{" "}
            <strong>di browser-mu</strong>. Video tidak direkam dan tidak dikirim ke server;
            hanya angka ringkasan. Hasilnya <em>catatan latihan</em>, bukan penilaian pasti.
          </span>
        </label>

        {/* ── Bahasa Sesi ── */}
        <div className="mt-5 rounded-xl border border-border bg-surface-2 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">Bahasa sesi</p>
          <div className="flex gap-2">
            {SESSION_LANGS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setSessionLang(l.value)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  sessionLang === l.value
                    ? "border-brand-500 bg-brand-500/10 text-brand-600"
                    : "border-slate-200 text-slate-500 hover:bg-surface-2"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Menentukan bahasa pertanyaan, transkrip jawaban, laporan akhir, dan suara
            pembacanya sekaligus — bukan cuma logat suaranya.
          </p>
        </div>

        {/* ── Mode Pertanyaan (TTS) ── */}
        {ttsSupported && (
          <div className="mt-5 rounded-xl border border-border bg-surface-2 px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">Mode pertanyaan</p>
            <div className="flex gap-2">
              {QUESTION_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setQuestionMode(m.value)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    questionMode === m.value
                      ? "border-brand-500 bg-brand-500/10 text-brand-600"
                      : "border-slate-200 text-slate-500 hover:bg-surface-2"
                  }`}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              &quot;Suara saja&quot; menyembunyikan teks pertanyaan — dituntut dengar &amp;
              paham langsung, lebih dekat ke wawancara asli. Bisa diganti lagi kapan saja
              saat sesi berjalan.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>
        )}

        <button
          onClick={() => void start()}
          disabled={starting}
          className="mt-5 w-full rounded-xl bg-brand-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 disabled:opacity-60"
        >
          {starting ? `⏳ ${startNote || "Menyiapkan…"}` : "🎙️ Mulai Wawancara"}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          🔒 Rekaman tidak disimpan — hanya transkrip &amp; angka metriknya.
        </p>
      </div>
    );

    return (
      <>
        {card}
        {historySlot}
      </>
    );
  }

  // ==== FASE SELESAI ====
  if (phase === "finishing") {
    return (
      <div className={`${CARD} p-10 text-center`}>
        <p className="text-lg font-semibold">
          {scoring ? "🧮 Menilai jawabanmu…" : "⏳ Menyelesaikan sesi…"}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {scoring ? "AI sedang menilai relevansi & kelengkapan jawaban." : "Menunggu transkrip terakhir."}
        </p>
      </div>
    );
  }

  // ==== FASE BERJALAN ====
  const isLast = index === questions.length - 1;
  return (
    <div className={`${CARD} p-6 md:p-8`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold">
          Pertanyaan {index + 1} / {questions.length}
          {title && <span className="ml-2 text-xs font-normal text-slate-400">· {title}</span>}
        </p>
        <div className="flex items-center gap-3 text-sm">
          {ttsSupported && (
            <div className="flex items-center gap-1 rounded-full border border-border bg-surface-2 p-1">
              {QUESTION_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  title={m.label}
                  onClick={() => setQuestionMode(m.value)}
                  className={`rounded-full px-2 py-1 text-xs transition ${
                    questionMode === m.value
                      ? "bg-brand-500 text-white"
                      : "text-slate-400 hover:bg-white"
                  }`}
                >
                  {m.icon}
                </button>
              ))}
            </div>
          )}
          {rec.visualState === "failed" && (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600">
              tanpa analisis visual
            </span>
          )}
          {rec.noMic ? (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600">
              tanpa mikrofon — jawaban tidak terekam
            </span>
          ) : (
            <span className="flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 font-semibold text-rose-500">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
              REC {rec.mmss}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        {/* ── kiri: kamera kecil ── */}
        {rec.visualState === "on" && (
          <div className="rounded-xl border border-border bg-surface-2 p-3 md:self-start">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={previewRef}
              muted
              playsInline
              className="w-full -scale-x-100 rounded-lg border border-border object-cover"
            />
            <p className="mt-2 text-[11px] leading-snug text-slate-400">
              🔒 Kamera aktif — dianalisis di browser, tidak disimpan &amp; tidak dikirim.
            </p>
          </div>
        )}

        {/* ── kanan: pertanyaan + suara + tombol ── */}
        <div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/40 px-5 py-6">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-500">
              👤 Pewawancara bertanya
            </p>
            {questionMode === "voice-only" ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {speaking ? "🔊 Membacakan pertanyaan…" : "✓ Pertanyaan sudah dibacakan"}
                </p>
                <button
                  type="button"
                  onClick={() => speak(questions[index] ?? "")}
                  className="shrink-0 rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
                >
                  🔁 Putar ulang
                </button>
              </div>
            ) : (
              <p className="mt-2 text-lg font-semibold leading-relaxed">{questions[index]}</p>
            )}
          </div>

          {!rec.noMic && <VoiceFrequency stream={rec.micStreamRef.current} variant="inline" />}

          {rec.capped && (
            <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
              Rekaman jawaban ini berhenti di batas 3 menit — lanjut ke pertanyaan
              berikutnya ya.
            </p>
          )}
          {rec.failedUploads > 0 && (
            <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
              {rec.failedUploads} jawaban gagal terkirim — transkripnya akan kosong di
              hasil.
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={isLast ? () => void finish() : nextQuestion}
              className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
            >
              {isLast ? "✅ Selesaikan Wawancara" : "Pertanyaan Berikutnya →"}
            </button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-400">
        <Link href="/simulation" className="underline">
          Batalkan sesi
        </Link>{" "}
        · jawabanmu langsung ditranskrip di latar belakang
      </p>
    </div>
  );
}
