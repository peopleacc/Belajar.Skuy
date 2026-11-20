"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSessionRecorder } from "@/components/simulation/useSessionRecorder";
import { PreparationScreen } from "@/components/simulation/PreparationScreen";
import MediaPipeConsentModal from "@/components/simulation/MediaPipeConsentModal";
import { isQuotaError } from "@/components/QuotaExceededModal";
import ActiveSessionModal, { type ActiveSessionData } from "@/components/simulation/ActiveSessionModal";
import { getTemplatesByCategory, getTemplateById, type InterviewTemplate } from "@/lib/interviewTemplates";

/**
 * Fitur BE — sesi simulasi wawancara. Mesin rekam/analisis/unggah SAMA PERSIS
 * dengan presentasi (useSessionRecorder); yang beda cuma alurnya: sistem yang
 * bertanya bergiliran, bukan user yang memimpin lewat slide.
 *
 * Fitur BF memakai komponen ini apa adanya — sesi tanya-jawab pasca-presentasi
 * secara teknis adalah sesi wawancara yang pertanyaannya dari ringkasan laporan.
 */

const MAX_ANSWER_SECONDS = 120; // 2 menit/jawaban — standardisasi durasi per pertanyaan
const CARD = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";
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
    flag: "ID",
    speech: "id-ID",
  },
  {
    value: "en",
    label: "English (Global)",
    desc: "Sesi penuh Bahasa Inggris untuk persiapan wawancara global.",
    flag: "EN",
    speech: "en-US",
  },
];

export default function InterviewRunner({
  presetSessionId,
  presetQuestions,
  title,
  initialIndex = 0,
  historySlot,
  skeletonAllowed = false,
  presetSessionLang,
  presetVisualEnabled,
  presetQuestionMode,
}: {
  /** Fitur BF — sesi Q&A yang sudah dibuat server; lewati fase setup. */
  presetSessionId?: string;
  presetQuestions?: string[];
  title?: string;
  initialIndex?: number;
  /**
   * Fitur DF — ringkasan & riwayat sesi sebelumnya (dirender di server).
   * Tampil HANYA di fase setup; saat sesi berjalan layar harus fokus ke
   * pertanyaan & kamera. Sesi Q&A (yang melewati fase setup) tidak pernah
   * menampilkannya sama sekali.
   */
  historySlot?: React.ReactNode;
  /** Hak akses visual kerangka pose/deteksi wajah (Update 19) */
  skeletonAllowed?: boolean;
  /** F62: Teruskan bahasa, visual & mode pertanyaan saat resume sesi */
  presetSessionLang?: "id" | "en";
  presetVisualEnabled?: boolean;
  presetQuestionMode?: QuestionMode;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>(presetSessionId ? "running" : "setup");
  const [role, setRole] = useState("");
  const [level, setLevel] = useState<string>("fresh");
  const [jobDesc, setJobDesc] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  // Task 11B: Mode Free Terkurasi vs Mode Kustom
  const [isFreeMode, setIsFreeMode] = useState(true);
  const jobTemplates = getTemplatesByCategory("job");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(jobTemplates[0]?.id ?? null);
  const [templateQuestions, setTemplateQuestions] = useState<string[] | null>(
    jobTemplates[0]?.questions.map((q) => q.question) ?? null
  );

  function handleSelectJobPreset(tpl: InterviewTemplate) {
    setSelectedTemplateId(tpl.id);
    setRole(tpl.role);
    setLevel(tpl.level);
    setJobDesc(tpl.description);
    setQuestionCount(tpl.questions.length);
    setTemplateQuestions(tpl.questions.map((q) => q.question));
  }

  useEffect(() => {
    if (isFreeMode && !selectedTemplateId && jobTemplates.length > 0) {
      handleSelectJobPreset(jobTemplates[0]);
    }
  }, [isFreeMode, selectedTemplateId, jobTemplates]);
  const [wantVisual, setWantVisual] = useState(presetVisualEnabled !== false);
  const [skeletonWanted, setSkeletonWanted] = useState(true);
  // Consent Gate MediaPipe (Task 2C-CG)
  const [mediaPipeConsent, setMediaPipeConsent] = useState<"granted" | "denied" | null>(null);
  const [consentModalOpen, setConsentModalOpen] = useState(false);

  const [questions, setQuestions] = useState<string[]>(presetQuestions ?? []);
  const [index, setIndex] = useState(initialIndex);
  const [activeSessionRecovery, setActiveSessionRecovery] = useState<ActiveSessionData | null>(null);
  const [starting, setStarting] = useState(false);
  const [startNote, setStartNote] = useState("");
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [questionMode, setQuestionMode] = useState<QuestionMode>(presetQuestionMode ?? "text");
  const [sessionLang, setSessionLang] = useState<SessionLang>(presetSessionLang ?? "id");
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
    (text: string, onDone?: () => void) => {
      if (!ttsSupported || !text) {
        onDone?.();
        return;
      }
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
      utter.onend = () => {
        setSpeaking(false);
        onDone?.();
      };
      utter.onerror = () => {
        setSpeaking(false);
        onDone?.();
      };
      window.speechSynthesis.speak(utter);
    },
    [ttsSupported, sessionLang]
  );

  const [mediaReady, setMediaReady] = useState(!presetSessionId);

  // F71: Bacakan pertanyaan & mulai perekaman segmen kandidat setelah pembacaan TTS selesai
  useEffect(() => {
    if (phase !== "running" || !mediaReady) return;
    const currentQ = questions[index] ?? "";
    if (questionMode !== "text" && ttsSupported && currentQ) {
      speak(currentQ, () => {
        rec.beginSegment();
      });
    } else {
      rec.beginSegment();
    }
    return () => {
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, [index, questionMode, phase, questions, speak, ttsSupported, mediaReady]);

  const rec = useSessionRecorder({
    maxSegmentSeconds: MAX_ANSWER_SECONDS,
    wantVisual,
    language: sessionLang,
  });

  // Pastikan hardware kamera & mic dilepas saat komponen unmount / navigasi keluar (Task 5E-MR)
  const releaseMediaRef = useRef(rec.releaseMedia);
  releaseMediaRef.current = rec.releaseMedia;

  useEffect(() => {
    return () => {
      releaseMediaRef.current();
    };
  }, []);

  // Sesi Q&A (BF): media disiapkan begitu komponen dipasang, tanpa fase setup.
  useEffect(() => {
    if (!presetSessionId) return;
    let alive = true;
    void (async () => {
      await rec.prepareMedia(setStartNote);
      if (!alive) return;
      setStartNote("");
      setMediaReady(true);
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

  // Muat persetujuan MediaPipe tersimpan di perangkat (Task 2C-CG)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("mediapipe_consent") as "granted" | "denied" | null;
    if (saved) {
      setMediaPipeConsent(saved);
      if (saved === "denied") {
        setWantVisual(false);
      }
    }
  }, []);

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

  function handleContinueToPrep() {
    if (isFreeMode) {
      if (!selectedTemplateId) {
        setError("Pilih salah satu posisi kerja untuk Mode Free.");
        return;
      }
    } else {
      if (role.trim().length < 3) {
        setError("Isi posisi yang dilamar dulu (minimal 3 karakter).");
        return;
      }
    }
    if (wantVisual && mediaPipeConsent !== "granted") {
      setConsentModalOpen(true);
      return;
    }
    void goToPreparation();
  }

  function handleConsentAccept() {
    if (typeof window !== "undefined") {
      localStorage.setItem("mediapipe_consent", "granted");
    }
    setMediaPipeConsent("granted");
    setWantVisual(true);
    setConsentModalOpen(false);
    void goToPreparation();
  }

  function handleConsentDeclineAudioOnly() {
    if (typeof window !== "undefined") {
      localStorage.setItem("mediapipe_consent", "denied");
    }
    setMediaPipeConsent("denied");
    setWantVisual(false);
    setConsentModalOpen(false);
    void goToPreparation();
  }

  async function startOfficialSession() {
    setError(null);
    setStarting(true);

    try {
      setStartNote(
        selectedTemplateId
          ? "Menyiapkan sesi latihan siap pakai…"
          : "AI sedang menyusun pertanyaan…"
      );

      const curTpl = (selectedTemplateId ? getTemplateById(selectedTemplateId) : null) || jobTemplates[0];
      const effectiveRole = (role || curTpl?.role || "Frontend Developer").trim();
      const effectiveLevel = level || curTpl?.level || "fresh";
      const effectiveDesc = (jobDesc || curTpl?.description || "").trim();
      const effectiveQuestions = (templateQuestions && templateQuestions.length > 0)
        ? templateQuestions
        : (curTpl?.questions.map((q) => q.question) ?? []);

      const contextPayload: Record<string, any> = {
        role: isFreeMode ? effectiveRole : role.trim(),
        level: isFreeMode ? effectiveLevel : level,
        jobDesc: isFreeMode ? effectiveDesc : jobDesc.trim(),
        questionCount: isFreeMode ? effectiveQuestions.length : questionCount,
      };
      if (isFreeMode && curTpl) {
        contextPayload.questions = effectiveQuestions;
        contextPayload.templateId = curTpl.id;
        contextPayload.isFree = true;
      }

      const res = await fetch("/api/simulation/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "interview",
          context: contextPayload,
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
        if (res.status === 409 && data.activeSession) {
          setActiveSessionRecovery(data.activeSession);
          rec.releaseMedia();
          setStarting(false);
          setPhase("setup");
          return;
        }
        if (res.status === 422 && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        } else {
          setSuggestions([]);
        }
        setError(data.error ?? "Gagal membuat sesi.");
        setStarting(false);
        if (!isQuotaError(res.status, data)) {
          rec.releaseMedia();
          setPhase("setup");
        }
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
      // F71: rec.beginSegment() dipicu otomatis oleh running effect setelah TTS selesai
    } catch {
      setError("Tidak bisa terhubung ke server. Coba lagi.");
      rec.releaseMedia();
      setPhase("setup");
    } finally {
      setStarting(false);
      setStartNote("");
    }
  }

  function nextQuestion() {
    rec.closeSegment(sessionIdRef.current ?? "", index);
    setIndex((i) => i + 1);
    // F71: rec.beginSegment() dipicu otomatis oleh running effect pada pergantian index setelah TTS selesai
  }

  async function finish() {
    setPhase("finishing");
    await rec.closeSegment(sessionIdRef.current ?? "", index);
    await rec.finalize();
    const sid = sessionIdRef.current;
    if (sid) {
      try {
        await fetch("/api/simulation/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "finish", sessionId: sid }),
        });
        // Non-blocking trigger penilaian skor di latar belakang (<800ms transisi UI)
        fetch("/api/simulation/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid }),
        }).catch(() => {});
      } catch {
        /* status tertinggal 'running' -> daftar sesi yang menangani */
      }
      router.push(`/simulation/${sid}`);
    }
  }

  // ---- fase setup ----
  if (phase === "setup") {
    const card = (
      <div className={`${CARD} p-8`}>
        {/* Header dengan Switcher Mode Free di Pojok Kanan Atas */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Simulasi Interview Kerja
              </h1>
              {isFreeMode && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f3f7] border border-slate-200/80 px-2.5 py-0.5 text-[11px] font-bold text-[#283157]">
                  <i className="bi bi-gift-fill text-[#283157] text-[10px]" /> Mode Free
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {isFreeMode
                ? "Pilih posisi profesi siap pakai untuk memulai simulasi terstruktur secara instan."
                : "Kustomisasi posisi, tingkat pengalaman, dan deskripsi pekerjaan sesuai kebutuhan Anda."}
            </p>
          </div>

          {/* Di pojok kanan atas: Switcher Mode Free vs Mode Kustom */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-[#f2f3f7] p-1 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => {
                setIsFreeMode(true);
                if (jobTemplates.length > 0) handleSelectJobPreset(jobTemplates[0]);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                isFreeMode
                  ? "bg-[#283157] text-white shadow-xs"
                  : "text-slate-600 hover:text-[#283157]"
              }`}
            >
              <i className="bi bi-gift-fill text-xs" />
              <span>Mode Free</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsFreeMode(false);
                setSelectedTemplateId(null);
                setTemplateQuestions(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                !isFreeMode
                  ? "bg-[#283157] text-white shadow-xs"
                  : "text-slate-600 hover:text-[#283157]"
              }`}
            >
              <i className="bi bi-sliders text-xs" />
              <span>Mode Kustom</span>
            </button>
          </div>
        </div>

        {/* Konten Berdasarkan Mode */}
        <div className="mt-6 space-y-5">
          {isFreeMode ? (
            /* ============================================================
               TAMPILAN MODE FREE (KHUSUS INTERVIEW KERJA):
               Hanya menampilkan posisi terkurasi siap pakai
               ============================================================ */
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <i className="bi bi-briefcase-fill text-[#283157]" />
                    Pilih Posisi Karier
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {jobTemplates.length} Posisi Siap Pakai
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {jobTemplates.map((tpl) => {
                    const active = selectedTemplateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleSelectJobPreset(tpl)}
                        className={`flex flex-col text-left rounded-xl border p-4 transition duration-150 hover:-translate-y-0.5 hover:shadow-sm ${
                          active
                            ? "border-[#283157] bg-[#f2f3f7] ring-1 ring-[#283157]/20 shadow-xs"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                              active ? "bg-[#283157] text-white" : "bg-[#f2f3f7] text-[#283157]"
                            }`}
                          >
                            <i className={`bi ${tpl.icon}`} />
                          </span>
                          <span className="rounded-full bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {tpl.level === "fresh" ? "Fresh Graduate" : tpl.level === "senior" ? "Senior" : "Menengah"}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{tpl.title}</h4>
                        <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {tpl.description}
                        </p>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400 font-medium">
                          <span>{tpl.questions.length} Pertanyaan</span>
                          <span>~{tpl.targetTimePerQuestionSec}s / Soal</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================
               TAMPILAN MODE KUSTOM (INPUT MANUAL SESI KERJA):
               Menampilkan input posisi manual, pengalaman, slider, dsb.
               ============================================================ */
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Posisi yang dilamar
                </label>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="mis. Frontend Developer, Data Analyst, Product Manager..."
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
                  <span className="text-brand-600 font-bold">{questionCount}</span>
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
                  placeholder="Tempel deskripsi lowongan atau kualifikasi di sini agar pertanyaan lebih relevan…"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white"
                />
              </div>
            </div>
          )}
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
                  Khusus Premium Presentasi, Gabungan, &amp; Pro
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
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
            <div className="flex items-start gap-2">
              <i className="bi bi-exclamation-triangle-fill text-rose-500 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold">{error}</p>
                {suggestions.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-rose-200/60">
                    <p className="font-semibold text-rose-800 text-[11px] mb-1.5 flex items-center gap-1">
                      <i className="bi bi-lightbulb-fill text-amber-500" />
                      <span>Saran posisi kerja alternatif yang valid:</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setRole(s);
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
                      <i className="bi bi-shield-check text-emerald-600" />
                      <span>Kuota sesi interview Anda tetap utuh karena sesi belum berjalan.</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleContinueToPrep}
          disabled={starting}
          className="mt-5 w-full rounded-xl bg-brand-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {starting ? (
            <>
              <i className="bi bi-hourglass-split animate-spin"></i>
              <span>{startNote || "Menyiapkan…"}</span>
            </>
          ) : (
            <>
              <span>{isFreeMode ? "Lanjut ke Persiapan (Mode Free)" : "Lanjut ke Persiapan Simulasi"}</span>
              <i className="bi bi-arrow-right"></i>
            </>
          )}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <i className="bi bi-shield-lock-fill text-slate-400"></i>
          <span>
            Izin mikrofon{wantVisual ? " & kamera" : ""} diminta saat masuk tahap persiapan. Rekaman tidak disimpan — hanya transkrip &amp; angka metriknya.
          </span>
        </p>
      </div>
    );

    return (
      <>
        {card}
        {historySlot}
        <MediaPipeConsentModal
          isOpen={consentModalOpen}
          onAccept={handleConsentAccept}
          onDeclineAudioOnly={handleConsentDeclineAudioOnly}
          onClose={() => setConsentModalOpen(false)}
        />
      </>
    );
  }

  // ---- fase persiapan mandiri (halaman penuh, bukan modal) ----
  if (phase === "preparing") {
    return (
      <>
        <PreparationScreen
          title={`Persiapan Wawancara: ${role || "Posisi Kerja"}`}
          subtitle="Periksa kesiapan kamera dan mikrofon Anda sebelum AI memulai sesi tanya-jawab wawancara."
          camStream={rec.camStreamRef.current}
          micStream={rec.micStreamRef.current}
          cameraReady={rec.visualState !== "failed" && wantVisual}
          voiceReady={!rec.noMic}
          simulationReady={role.trim().length >= 3}
          skeletonEnabled={skeletonWanted && skeletonAllowed}
          mediaPipeConsent={mediaPipeConsent}
          onToggleMediaPipeConsent={() => setConsentModalOpen(true)}
          starting={starting}
          startNote={startNote}
          error={error}
          targetPlan="premium_presentasi"
          onStart={() => void startOfficialSession()}
          onCancel={() => {
            rec.releaseMedia();
            setError(null);
            setPhase("setup");
          }}
        />
        <MediaPipeConsentModal
          isOpen={consentModalOpen}
          onAccept={handleConsentAccept}
          onDeclineAudioOnly={handleConsentDeclineAudioOnly}
          onClose={() => setConsentModalOpen(false)}
        />
      </>
    );
  }

  // ---- fase selesai ----
  if (phase === "finishing") {
    const isDraining = rec.queueStats.queued > 0 || rec.queueStats.uploading > 0;
    const progressPercent =
      rec.queueStats.total > 0
        ? Math.round((rec.queueStats.done / rec.queueStats.total) * 100)
        : 100;

    return (
      <div className={`${CARD} p-10 text-center max-w-lg mx-auto`}>
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 shadow-sm">
          {scoring ? (
            <i className="bi bi-cpu text-2xl animate-pulse" />
          ) : (
            <i className="bi bi-cloud-arrow-up text-2xl animate-bounce" />
          )}
        </div>
        <p className="text-xl font-bold tracking-tight text-slate-900">
          {scoring
            ? "Menganalisis Laporan & Penilaian AI…"
            : "Menyimpan Seluruh Rekaman Suara…"}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {scoring
            ? "AI sedang mengevaluasi relevansi jawaban, struktur penjelasan, dan indikator non-verbal Anda."
            : `Mengunggah & memproses transkrip audio segmen (${rec.queueStats.done}/${rec.queueStats.total || questions.length})…`}
        </p>

        {/* Progress bar upload audio (Task 6F-AH) */}
        {!scoring && (
          <div className="mt-6">
            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
              <span>Progres Sinkronisasi Transkrip</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-brand-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
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

      {/* Grid Layout Sesuai Mockup 2: Kamera Kiri (Border Biru) + Pertanyaan Kanan */}
      <div className="grid gap-6 md:grid-cols-12 items-stretch">
        {/* ================= KOLOM KIRI: KAMERA BINGKAI AKSEN BIRU ================= */}
        <div className="md:col-span-7 flex flex-col justify-center">
          {rec.visualState === "on" ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border-2 border-brand-500 bg-slate-950 shadow-sm">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={previewRef}
                muted
                playsInline
                autoPlay
                className="h-full w-full -scale-x-100 object-cover"
              />
              <canvas
                ref={overlayCanvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover"
              />

              {/* Status Overlay Minimalis */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <span className="flex items-center gap-1.5 rounded-full bg-slate-950/70 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold text-rose-400 border border-slate-700/60 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>REC {rec.mmss}</span>
                </span>

                {skeletonWanted && skeletonAllowed && (
                  <span className="rounded-md bg-purple-600/90 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
                    Skeleton ON
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-400">
              <i className="bi bi-camera-video-off text-3xl mb-2 text-slate-400" />
              <p className="text-xs font-medium">Kamera tidak aktif</p>
            </div>
          )}
        </div>

        {/* ================= KOLOM KANAN: CARD PERTANYAAN & LANJUTKAN ================= */}
        <div className="md:col-span-5 flex flex-col">
          <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm min-h-[300px]">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Pertanyaan
                </p>
                <span className="text-xs font-bold text-brand-600">
                  {index + 1} / {questions.length}
                </span>
              </div>

              {questionMode === "voice-only" ? (
                <div className="my-6 rounded-xl bg-slate-50 p-4 border border-slate-200/70">
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    {speaking ? (
                      <>
                        <i className="bi bi-volume-up-fill text-brand-500 animate-pulse"></i>
                        <span>Membacakan pertanyaan…</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill text-emerald-500"></i>
                        <span>Pertanyaan telah dibacakan</span>
                      </>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => speak(questions[index] ?? "")}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition"
                  >
                    <i className="bi bi-arrow-repeat"></i>
                    <span>Putar ulang audio</span>
                  </button>
                </div>
              ) : (
                <div className="my-6">
                  <p className="text-lg md:text-xl font-bold leading-relaxed text-slate-800">
                    {questions[index]}
                  </p>
                  {ttsSupported && speaking && (
                    <p className="mt-3 text-xs text-brand-600 flex items-center gap-1.5 animate-pulse">
                      <i className="bi bi-volume-up-fill"></i>
                      <span>Membacakan pertanyaan…</span>
                    </p>
                  )}
                </div>
              )}

              {rec.capped && (
                <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700 border border-amber-200">
                  Rekaman jawaban mencapai batas 2 menit. Silakan lanjutkan.
                </p>
              )}
            </div>

            <div className="pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={isLast ? () => void finish() : nextQuestion}
                className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 px-6 text-sm shadow-md shadow-brand-500/20 transition active:scale-95 flex items-center justify-center gap-2"
              >
                {isLast ? (
                  <>
                    <i className="bi bi-check-circle-fill"></i>
                    <span>Selesaikan Wawancara</span>
                  </>
                ) : (
                  <>
                    <span>Lanjutkan</span>
                    <i className="bi bi-arrow-right"></i>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-400">
        <Link href="/simulation" className="underline">
          Batalkan sesi
        </Link>{" "}
        · jawabanmu langsung ditranskrip di latar belakang
      </p>

      {activeSessionRecovery && (
        <ActiveSessionModal
          session={activeSessionRecovery}
          onClose={() => setActiveSessionRecovery(null)}
          onAbandonComplete={() => setActiveSessionRecovery(null)}
        />
      )}
    </div>
  );
}
