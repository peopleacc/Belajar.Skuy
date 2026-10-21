"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSessionRecorder } from "@/components/simulation/useSessionRecorder";
import { VoiceFrequency } from "@/components/simulation/VoiceFrequency";
import { PreparationScreen } from "@/components/simulation/PreparationScreen";
import { LiveCadenceHUD } from "@/components/simulation/LiveCadenceHUD";

/**
 * Fitur BE — sesi simulasi wawancara. Mesin rekam/analisis/unggah SAMA PERSIS
 * dengan presentasi (useSessionRecorder); yang beda cuma alurnya: sistem yang
 * bertanya bergiliran, bukan user yang memimpin lewat slide.
 *
 * Fitur BF memakai komponen ini apa adanya — sesi tanya-jawab pasca-presentasi
 * secara teknis adalah sesi wawancara yang pertanyaannya dari ringkasan laporan.
 */

const MAX_ANSWER_SECONDS = 120; // 2 menit/jawaban — standardisasi durasi per pertanyaan
const CARD = "rounded-sm bg-white shadow-card";
const LEVELS: {
  value: "fresh" | "menengah" | "senior";
  label: string;
  desc: string;
  icon: string;
}[] = [
  {
    value: "fresh",
    label: "Fresh Graduate",
    desc: "0 - 1 th pengalaman. Konsep fundamental & pemahaman dasar.",
    icon: "bi-mortarboard-fill",
  },
  {
    value: "menengah",
    label: "Tingkat Menengah",
    desc: "2 - 4 th pengalaman. Best practice & studi kasus proyek riil.",
    icon: "bi-briefcase-fill",
  },
  {
    value: "senior",
    label: "Tingkat Senior",
    desc: "5+ th pengalaman. Arsitektur sistem, trade-off, & strategi.",
    icon: "bi-award-fill",
  },
];

type Phase = "setup" | "preparing" | "running" | "finishing";

// Fitur DD — mode tampilan pertanyaan. Preferensi tampilan CLIENT MURNI, tidak
// dikirim/disimpan ke server (beda dari wantVisual yang memengaruhi metrik).
type QuestionMode = "text" | "text-voice" | "voice-only";
const QUESTION_MODES: {
  value: QuestionMode;
  label: string;
  desc: string;
  icon: string;
}[] = [
  {
    value: "text",
    label: "Teks Saja",
    desc: "Pertanyaan tampil teks di layar tanpa suara otomatis.",
    icon: "bi-file-earmark-text-fill",
  },
  {
    value: "text-voice",
    label: "Teks + Suara",
    desc: "Pertanyaan dibacakan suara AI dan teks tetap tampil.",
    icon: "bi-volume-up-fill",
  },
  {
    value: "voice-only",
    label: "Suara Saja",
    desc: "Teks disembunyikan. Latih mendengar seperti telepon riil.",
    icon: "bi-headphones",
  },
];

// Fitur DL — bahasa sesi. Bukan cuma logat suara: pertanyaan yang disusun AI,
// transkrip jawaban, dan laporan akhir semuanya ikut bahasa ini. Kalau cuma
// suaranya yang diganti, hasilnya suara Inggris membacakan teks Indonesia.
type SessionLang = "id" | "en";
const SESSION_LANGS: {
  value: SessionLang;
  label: string;
  desc: string;
  flag: string;
  speech: string;
}[] = [
  {
    value: "id",
    label: "Bahasa Indonesia",
    desc: "Pertanyaan, transkrip, laporan, & suara dalam Bahasa Indonesia.",
    flag: "🇮🇩",
    speech: "id-ID",
  },
  {
    value: "en",
    label: "English (Global)",
    desc: "Sesi penuh Bahasa Inggris untuk persiapan wawancara global.",
    flag: "🇬🇧",
    speech: "en-US",
  },
];

export default function InterviewRunner({
  presetSessionId,
  presetQuestions,
  title,
  historySlot,
  skeletonAllowed = false,
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
  /** Hak akses visual kerangka pose/deteksi wajah (Update 19) */
  skeletonAllowed?: boolean;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>(presetSessionId ? "running" : "setup");
  const [role, setRole] = useState("");
  const [level, setLevel] = useState<string>("fresh");
  const [jobDesc, setJobDesc] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [wantVisual, setWantVisual] = useState(true);
  const [skeletonWanted, setSkeletonWanted] = useState(true);

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
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
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
    language: sessionLang,
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
      rec.setOverlayCanvas(overlayCanvasRef.current, skeletonWanted && skeletonAllowed);
    }
  }, [phase, rec, skeletonWanted, skeletonAllowed]);

  async function goToPreparation() {
    if (role.trim().length < 3) {
      setError("Isi posisi yang dilamar dulu (minimal 3 karakter).");
      return;
    }
    setError(null);
    setStarting(true);

    await rec.prepareMedia(setStartNote);
    setStarting(false);
    setStartNote("");
    setPhase("preparing");
  }

  async function startOfficialSession() {
    setError(null);
    setStarting(true);

    try {
      setStartNote("AI sedang menyusun pertanyaan…");
      const res = await fetch("/api/simulation/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "interview",
          context: { role: role.trim(), level, jobDesc: jobDesc.trim(), questionCount },
          settings: {
            language: sessionLang,
            noMic: rec.noMic,
            visualEnabled: rec.visualState !== "failed" && wantVisual,
            skeletonEnabled: skeletonWanted && skeletonAllowed,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat sesi.");
        setStarting(false);
        setPhase("setup");
        return;
      }
      sessionIdRef.current = data.sessionId;

      // Pertanyaan disusun server; klien mengambilnya untuk ditampilkan.
      const qRes = await fetch(`/api/simulation/questions?sessionId=${data.sessionId}`);
      const qData = await qRes.json();
      if (!qRes.ok || !Array.isArray(qData.questions) || qData.questions.length === 0) {
        setError("Sesi dibuat tapi pertanyaannya gagal dimuat. Buka dari daftar sesi.");
        setStarting(false);
        setPhase("setup");
        return;
      }
      setQuestions(qData.questions);
      setIndex(0);
      setPhase("running");
      rec.beginSegment();
    } catch {
      setError("Tidak bisa terhubung ke server. Coba lagi.");
      setPhase("setup");
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
            <label className="mb-2 block text-xs font-semibold text-slate-600">
              Tingkat pengalaman
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {LEVELS.map((l) => {
                const active = level === l.value;
                return (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setLevel(l.value)}
                    className={`group relative flex flex-col items-start rounded-xl border p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                      active
                        ? "border-brand-500 bg-brand-500/10 text-brand-700 shadow-sm ring-1 ring-brand-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
                        active
                          ? "bg-brand-500 text-white"
                          : "bg-brand-500/10 text-brand-600 group-hover:bg-brand-500/20"
                      }`}
                    >
                      <i className={`bi ${l.icon}`}></i>
                    </span>
                    <p className={`text-xs font-bold ${active ? "text-brand-700" : "text-slate-800"}`}>
                      {l.label}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      {l.desc}
                    </p>
                  </button>
                );
              })}
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

        {/* Visual Kerangka / Pose Skeleton Toggle (Fitur Update 19) */}
        <div
          className={`mt-3 flex items-start justify-between gap-4 rounded-xl border p-4 transition ${
            skeletonAllowed
              ? "border-brand-200 bg-brand-50/40"
              : "border-slate-200 bg-slate-50 opacity-75"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-800">
                Aktifkan Visual Kerangka di Deteksi Kamera
              </span>
              {!skeletonAllowed && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  🔒 Khusus Premium Presentasi, Gabungan, &amp; Pro
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Tampilkan garis kerangka tubuh, sendi tangan, dan titik pupil iris secara visual di kamera peserta wawancara.
            </p>
          </div>
          <input
            type="checkbox"
            checked={skeletonWanted && skeletonAllowed}
            disabled={!skeletonAllowed || starting}
            onChange={(e) => setSkeletonWanted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded accent-brand-500 disabled:cursor-not-allowed"
          />
        </div>

        {/* Fitur DL — bahasa sesi. Ditampilkan APA PUN dukungan TTS, karena
            pengaruhnya bukan cuma ke suara: pertanyaan, transkrip, dan laporan
            akhir juga ikut bahasa ini. */}
        <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4">
          <p className="mb-2 text-xs font-semibold text-slate-600">Bahasa sesi</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {SESSION_LANGS.map((l) => {
              const active = sessionLang === l.value;
              return (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setSessionLang(l.value)}
                  className={`group relative flex flex-col items-start rounded-xl border p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                    active
                      ? "border-brand-500 bg-brand-500/10 text-brand-700 shadow-sm ring-1 ring-brand-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span
                    className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg text-base transition ${
                      active ? "bg-brand-500/20" : "bg-slate-100 group-hover:bg-slate-200"
                    }`}
                  >
                    {l.flag}
                  </span>
                  <p className={`text-xs font-bold ${active ? "text-brand-700" : "text-slate-800"}`}>
                    {l.label}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    {l.desc}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Menentukan bahasa pertanyaan, transkrip jawaban, laporan akhir, dan suara
            pembacanya sekaligus — bukan cuma logat suaranya.
          </p>
        </div>

        {ttsSupported && (
          <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4">
            <p className="mb-2 text-xs font-semibold text-slate-600">Mode pertanyaan</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {QUESTION_MODES.map((m) => {
                const active = questionMode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setQuestionMode(m.value)}
                    className={`group relative flex flex-col items-start rounded-xl border p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                      active
                        ? "border-brand-500 bg-brand-500/10 text-brand-700 shadow-sm ring-1 ring-brand-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
                        active
                          ? "bg-brand-500 text-white"
                          : "bg-brand-500/10 text-brand-600 group-hover:bg-brand-500/20"
                      }`}
                    >
                      <i className={`bi ${m.icon}`}></i>
                    </span>
                    <p className={`text-xs font-bold ${active ? "text-brand-700" : "text-slate-800"}`}>
                      {m.label}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      {m.desc}
                    </p>
                  </button>
                );
              })}
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
          onClick={() => void goToPreparation()}
          disabled={starting}
          className="mt-5 w-full rounded-xl bg-brand-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
        >
          {starting ? `⏳ ${startNote || "Menyiapkan…"}` : "👉 Lanjut ke Persiapan Simulasi"}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Izin mikrofon{wantVisual ? " & kamera" : ""} diminta saat masuk tahap persiapan. 🔒 Rekaman tidak disimpan — hanya transkrip & angka metriknya.
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

  // ---- fase persiapan mandiri (halaman penuh, bukan modal) ----
  if (phase === "preparing") {
    return (
      <PreparationScreen
        title={`Persiapan Wawancara: ${role || "Posisi Kerja"}`}
        subtitle="Periksa kesiapan kamera dan mikrofon Anda sebelum AI memulai sesi tanya-jawab wawancara."
        camStream={rec.camStreamRef.current}
        micStream={rec.micStreamRef.current}
        cameraReady={rec.visualState !== "failed" && wantVisual}
        voiceReady={!rec.noMic}
        simulationReady={role.trim().length >= 3}
        skeletonEnabled={skeletonWanted && skeletonAllowed}
        starting={starting}
        startNote={startNote}
        onStart={() => void startOfficialSession()}
        onCancel={() => setPhase("setup")}
      />
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
                  <i className={`bi ${m.icon}`}></i>
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

      {/* Grid Layout Sesuai Wireframe Gambar 3 */}
      <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
        {/* ================= KOLOM KIRI ================= */}
        <div className="flex flex-col gap-4">
          {/* Kotak Atas: Kamera Kandidat Besar */}
          {rec.visualState === "on" ? (
            <div className="rounded-xl border border-border bg-surface-2 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <span>📷</span> Kamera Kandidat
                </p>
                <div className="flex items-center gap-2">
                  {skeletonWanted && skeletonAllowed && (
                    <span className="rounded-md bg-purple-600/90 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
                      Skeleton ON
                    </span>
                  )}
                  <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-500">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" /> REC {rec.mmss}
                  </span>
                </div>
              </div>
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-slate-900 shadow-inner">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={previewRef}
                  muted
                  playsInline
                  className="h-full w-full -scale-x-100 object-cover"
                />
                <canvas
                  ref={overlayCanvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover"
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                🔒 Dianalisis secara lokal di browser — tatap ke arah lensa untuk kontak mata optimal.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-400">
              <i className="bi bi-camera-video-off text-2xl mb-1" />
              <p className="text-xs">Kamera tidak aktif</p>
            </div>
          )}

          {/* Kotak Bawah: Pertanyaan Wawancara & Sesi Tanya Jawab */}
          <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 border-b border-brand-200/50 pb-2">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-600">
                👤 Pertanyaan Pewawancara
              </p>
              {ttsSupported && (
                <div className="flex items-center gap-1 rounded-full border border-brand-200 bg-white p-1">
                  {QUESTION_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      title={m.label}
                      onClick={() => setQuestionMode(m.value)}
                      className={`rounded-full px-2 py-0.5 text-xs transition ${
                        questionMode === m.value
                          ? "bg-brand-500 text-white"
                          : "text-slate-400 hover:bg-slate-100"
                      }`}
                    >
                      <i className={`bi ${m.icon}`}></i>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {questionMode === "voice-only" ? (
              <div className="my-3 flex items-center justify-between gap-3 rounded-lg bg-white p-3 border border-brand-100">
                <p className="text-sm text-slate-600">
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
              <p className="my-3 text-base md:text-lg font-semibold leading-relaxed text-slate-800">
                {questions[index]}
              </p>
            )}

            {rec.capped && (
              <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                Rekaman jawaban ini berhenti di batas 2 menit — silakan lanjut ke pertanyaan berikutnya.
              </p>
            )}
            {rec.failedUploads > 0 && (
              <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
                {rec.failedUploads} jawaban gagal terkirim — transkripnya akan kosong di hasil.
              </p>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-brand-100 pt-4">
              <span className="text-xs text-slate-500 font-medium">
                Pertanyaan {index + 1} dari {questions.length}
              </span>
              <button
                onClick={isLast ? () => void finish() : nextQuestion}
                className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95"
              >
                {isLast ? "✅ Selesaikan Wawancara" : "Pertanyaan Berikutnya →"}
              </button>
            </div>
          </div>
        </div>

        {/* ================= KOLOM KANAN ================= */}
        <div className="flex flex-col gap-4">
          {/* Kotak Atas: Timer & Preview Fokus Mata / Live Cadence HUD */}
          <div className="rounded-xl border border-border bg-surface-2 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                ⏱️ Timer &amp; Fokus Mata
              </p>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600">
                Maks 2:00
              </span>
            </div>
            <LiveCadenceHUD cadence={rec.cadence} />
          </div>

          {/* Kotak Bawah: Frekuensi Suara Masuk */}
          {!rec.noMic && (
            <div className="rounded-xl border border-slate-200 bg-surface-2 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  🎙️ Frekuensi Suara Masuk
                </p>
                <span className="text-[10px] text-emerald-600 font-semibold">● Audio Live</span>
              </div>
              <VoiceFrequency stream={rec.micStreamRef.current} variant="inline" />
            </div>
          )}
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
