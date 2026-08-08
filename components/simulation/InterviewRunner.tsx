"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSessionRecorder } from "@/components/simulation/useSessionRecorder";
import { VoiceFrequency } from "@/components/simulation/VoiceFrequency";

/**
 * Fitur BE — sesi simulasi wawancara. Mesin rekam/analisis/unggah SAMA PERSIS
 * dengan presentasi (useSessionRecorder); yang beda cuma alurnya: sistem yang
 * bertanya bergiliran, bukan user yang memimpin lewat slide.
 *
 * Fitur BF memakai komponen ini apa adanya — sesi tanya-jawab pasca-presentasi
 * secara teknis adalah sesi wawancara yang pertanyaannya dari ringkasan laporan.
 */

const MAX_ANSWER_SECONDS = 180; // 3 menit/jawaban — lebih pendek dari slide presentasi
const CARD = "rounded-sm bg-white shadow-card";
const LEVELS = [
  { value: "fresh", label: "Fresh graduate" },
  { value: "menengah", label: "Menengah" },
  { value: "senior", label: "Senior" },
] as const;

type Phase = "setup" | "running" | "finishing";

// Fitur DD — mode tampilan pertanyaan. Preferensi tampilan CLIENT MURNI, tidak
// dikirim/disimpan ke server (beda dari wantVisual yang memengaruhi metrik).
type QuestionMode = "text" | "text-voice" | "voice-only";
const QUESTION_MODES: { value: QuestionMode; label: string; icon: string }[] = [
  { value: "text", label: "Teks", icon: "📄" },
  { value: "text-voice", label: "Teks + Suara", icon: "🔊" },
  { value: "voice-only", label: "Suara saja", icon: "🎧" },
];

// Fitur DL — bahasa sesi. Bukan cuma logat suara: pertanyaan yang disusun AI,
// transkrip jawaban, dan laporan akhir semuanya ikut bahasa ini. Kalau cuma
// suaranya yang diganti, hasilnya suara Inggris membacakan teks Indonesia.
type SessionLang = "id" | "en";
const SESSION_LANGS: { value: SessionLang; label: string; speech: string }[] = [
  { value: "id", label: "🇮🇩 Suara Indonesia", speech: "id-ID" },
  { value: "en", label: "🇬🇧 Suara Inggris", speech: "en-US" },
];

export default function InterviewRunner({
  presetSessionId,
  presetQuestions,
  title,
  historySlot,
}: {
  /** Fitur BF — sesi Q&A yang sudah dibuat server; lewati fase setup. */
  presetSessionId?: string;
  presetQuestions?: string[];
  title?: string;
  /**
   * Fitur DF — ringkasan & riwayat sesi sebelumnya (dirender di server).
   * Tampil HANYA di fase setup; saat sesi berjalan layar harus fokus ke
   * pertanyaan & kamera. Sesi Q&A (yang melewati fase setup) tidak pernah
   * menampilkannya sama sekali.
   */
  historySlot?: React.ReactNode;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>(presetSessionId ? "running" : "setup");
  const [role, setRole] = useState("");
  const [level, setLevel] = useState<string>("fresh");
  const [jobDesc, setJobDesc] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [wantVisual, setWantVisual] = useState(true);

  const [questions, setQuestions] = useState<string[]>(presetQuestions ?? []);
  const [index, setIndex] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startNote, setStartNote] = useState("");
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionMode, setQuestionMode] = useState<QuestionMode>("text");
  const [sessionLang, setSessionLang] = useState<SessionLang>("id");
  const [speaking, setSpeaking] = useState(false);
  // Dicek setelah mount (bukan langsung true/false) — hindari mismatch SSR/client.
  const [ttsSupported, setTtsSupported] = useState(false);

  const sessionIdRef = useRef<string | null>(presetSessionId ?? null);
  const previewRef = useRef<HTMLVideoElement>(null);
  // Suara per-bahasa yang tersedia di perangkat. `utter.lang` saja cuma
  // "permintaan" — browser tidak selalu otomatis cocokkan ke suara yang tepat,
  // jadi suaranya dipilih eksplisit kalau ada.
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const supported = typeof window !== "undefined" && "speechSynthesis" in window;
    setTtsSupported(supported);
    if (!supported) return;

    function loadVoices() {
      voicesRef.current = window.speechSynthesis.getVoices();
    }
    // Daftar suara kadang belum siap saat mount (kasus umum di Chrome) — dicoba
    // langsung, lalu diulang saat browser selesai memuatnya.
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

  // Bacakan otomatis tiap pertanyaan berganti, kalau mode-nya minta suara.
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

  // Sesi Q&A (BF): media disiapkan begitu komponen dipasang, tanpa fase setup.
  useEffect(() => {
    if (!presetSessionId) return;
    let alive = true;
    void (async () => {
      await rec.prepareMedia(setStartNote);
      if (!alive) return;
      setStartNote("");
      rec.beginSegment();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetSessionId]);

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

  async function start() {
    if (role.trim().length < 3) {
      setError("Isi posisi yang dilamar dulu (minimal 3 karakter).");
      return;
    }
    setError(null);
    setStarting(true);

    const { micOk, visualOk } = await rec.prepareMedia(setStartNote);

    try {
      setStartNote("AI sedang menyusun pertanyaan…");
      const res = await fetch("/api/simulation/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "interview",
          context: { role: role.trim(), level, jobDesc: jobDesc.trim(), questionCount },
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

      // Pertanyaan disusun server; klien mengambilnya untuk ditampilkan.
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

  // ---- fase setup ----
  if (phase === "setup") {
    const card = (
      <div className={`${CARD} p-8`}>
        <h1 className="text-2xl font-bold tracking-tight">Simulasi Wawancara</h1>
        <p className="mt-2 text-sm text-slate-500">
          Isi konteks posisinya — tanpa itu pertanyaannya jadi generik dan tidak berguna
          untuk latihan.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Posisi yang dilamar
            </label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="mis. Frontend Developer"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Tingkat pengalaman
            </label>
            <div className="flex gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLevel(l.value)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    level === l.value
                      ? "border-brand-500 bg-brand-500/10 text-brand-600"
                      : "border-slate-200 text-slate-500 hover:bg-surface-2"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
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

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Deskripsi pekerjaan <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <textarea
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Tempel deskripsi lowongannya di sini biar pertanyaannya lebih relevan…"
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white"
            />
          </div>
        </div>

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

        {/* Fitur DL — bahasa sesi. Ditampilkan APA PUN dukungan TTS, karena
            pengaruhnya bukan cuma ke suara: pertanyaan, transkrip, dan laporan
            akhir juga ikut bahasa ini. */}
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
          {starting ? `⏳ ${startNote || "Menyiapkan…"}` : "🎤 Mulai Wawancara"}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          🔒 Rekaman tidak disimpan — hanya transkrip & angka metriknya.
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

  // ---- fase selesai ----
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

  // ---- fase berjalan ----
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
        {/* ---- kiri: kamera kecil ---- */}
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

        {/* ---- kanan: pertanyaan + suara + tombol ---- */}
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
