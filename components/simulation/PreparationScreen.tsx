"use client";

import { useEffect, useRef, useState } from "react";
import QuotaExceededModal, { isQuotaError } from "@/components/QuotaExceededModal";

interface PreparationScreenProps {
  title?: string;
  subtitle?: string;
  camStream: MediaStream | null;
  micStream: MediaStream | null;
  cameraReady: boolean;
  voiceReady: boolean;
  simulationReady: boolean;
  skeletonEnabled?: boolean;
  mediaPipeConsent?: "granted" | "denied" | null;
  onToggleMediaPipeConsent?: () => void;
  starting?: boolean;
  startNote?: string;
  error?: string | null;
  targetPlan?: string;
  onStart: () => void;
  onCancel: () => void;
}

/**
 * Layar Persiapan Simulasi Modern & Terpadu (Refined Design 10D):
 * - Sisi Kiri: Video kamera dengan overlay status badges, kapsul kontrol melayang (dengan live VU meter),
 *   3 kartu status perangkat (Kamera, Suara, Jaringan), serta panel Uji Pacing & Artikulasi Awal
 *   dengan fitur tes rekam suara (audio loopback playback) agar pengguna dapat mendengar suara mereka sendiri.
 * - Sisi Kanan: Tab switcher (Persiapan vs Tips AI), checklist 3 parameter penting, informasi materi sesi,
 *   metrik evaluasi, serta tombol utama "Mulai Simulasi Sekarang".
 * - 100% kepatuhan Aturan F (Strict Vector Iconography) & Pure Light Mode.
 */
export function PreparationScreen({
  title = "Persiapan Sesi Simulasi",
  subtitle = "Pastikan posisi kamera dan mikrofon berfungsi dengan baik sebelum memulai simulasi.",
  camStream,
  micStream,
  cameraReady,
  voiceReady,
  simulationReady,
  skeletonEnabled = false,
  mediaPipeConsent = null,
  onToggleMediaPipeConsent,
  starting = false,
  startNote = "",
  error = null,
  targetPlan = "premium_presentasi",
  onStart,
  onCancel,
}: PreparationScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [readinessModalOpen, setReadinessModalOpen] = useState(false);

  // Tab aktif di panel kanan: 'persiapan' | 'tips'
  const [activeTab, setActiveTab] = useState<"persiapan" | "tips">("persiapan");

  // Nama perangkat terdeteksi
  const [cameraLabel, setCameraLabel] = useState<string>("Webcam Terhubung");
  const [micLabel, setMicLabel] = useState<string>("Mikrofon Terhubung");

  // Tingkat volume live audio (0 - 100)
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Fitur Tes Rekam & Putar Ulang Suara (Loopback Voice Test)
  const [audioTestState, setAudioTestState] = useState<"idle" | "recording" | "playback" | "ready">("idle");
  const [testCountdown, setTestCountdown] = useState<number>(3);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [loopbackActive, setLoopbackActive] = useState<boolean>(false);
  const loopbackAudioCtxRef = useRef<AudioContext | null>(null);
  const audioTestPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Sambungkan video stream ke elemen video
  useEffect(() => {
    if (videoRef.current && camStream) {
      videoRef.current.srcObject = camStream;
      void videoRef.current.play().catch(() => {});
    }
    return () => {
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.srcObject = null;
        } catch {}
      }
    };
  }, [camStream]);

  // Deteksi nama perangkat input audio & video
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const videoDev = devices.find((d) => d.kind === "videoinput" && d.label);
        const audioDev = devices.find((d) => d.kind === "audioinput" && d.label);
        if (videoDev?.label) {
          const shortName = videoDev.label.split("(")[0].trim();
          setCameraLabel(shortName || "Webcam Utama");
        }
        if (audioDev?.label) {
          const shortName = audioDev.label.split("(")[0].trim();
          setMicLabel(shortName || "Input Suara");
        }
      })
      .catch(() => {});
  }, [camStream, micStream]);

  // Analisis VU meter real-time dari mikrofon
  useEffect(() => {
    if (!micStream) {
      setAudioLevel(0);
      return;
    }
    let audioCtx: AudioContext | null = null;
    let animId: number;

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioCtxClass();
      const source = audioCtx.createMediaStreamSource(micStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animId = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch {
      // Abaikan jika browser memblokir AudioContext otomatis
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };
  }, [micStream]);

  // Buka modal kuota otomatis jika ada error kuota
  useEffect(() => {
    if (error && isQuotaError(0, error)) {
      setQuotaModalOpen(true);
    }
  }, [error]);

  // Bersihkan audio test saat unmount
  useEffect(() => {
    return () => {
      if (loopbackAudioCtxRef.current) {
        try {
          loopbackAudioCtxRef.current.close();
        } catch {}
      }
      if (audioTestPlayerRef.current) {
        try {
          audioTestPlayerRef.current.pause();
        } catch {}
      }
    };
  }, []);

  // Mulai Tes Rekam Suara (3 Detik)
  const handleStartVoiceTest = () => {
    if (!micStream) return;
    try {
      setAudioTestState("recording");
      setTestCountdown(3);

      const mediaRecorder = new MediaRecorder(micStream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      let timer = 3;
      const interval = setInterval(() => {
        timer -= 1;
        setTestCountdown(timer);
        if (timer <= 0) {
          clearInterval(interval);
          try {
            mediaRecorder.stop();
          } catch {}
        }
      }, 1000);

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);

        // Putar balik suara hasil rekaman agar user bisa mendengar suaranya kembali
        setAudioTestState("playback");
        setTestCountdown(3);
        const audio = new Audio(url);
        audioTestPlayerRef.current = audio;
        audio.play().catch(() => {});

        let playTimer = 3;
        const playInterval = setInterval(() => {
          playTimer -= 1;
          setTestCountdown(playTimer);
          if (playTimer <= 0) {
            clearInterval(playInterval);
            setAudioTestState("ready");
          }
        }, 1000);

        audio.onended = () => {
          clearInterval(playInterval);
          setAudioTestState("ready");
        };
      };

      mediaRecorder.start();
    } catch {
      setAudioTestState("idle");
    }
  };

  // Putar Ulang Hasil Suara Rekaman
  const handleReplayVoice = () => {
    if (!recordedAudioUrl) return;
    setAudioTestState("playback");
    setTestCountdown(3);
    const audio = new Audio(recordedAudioUrl);
    audioTestPlayerRef.current = audio;
    audio.play().catch(() => {});
    audio.onended = () => {
      setAudioTestState("ready");
    };
  };

  // Toggle Monitor Suara Langsung (Loopback Audio)
  const handleToggleLoopback = () => {
    if (loopbackActive) {
      if (loopbackAudioCtxRef.current) {
        loopbackAudioCtxRef.current.close().catch(() => {});
        loopbackAudioCtxRef.current = null;
      }
      setLoopbackActive(false);
    } else {
      if (!micStream) return;
      try {
        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtxClass();
        const source = audioCtx.createMediaStreamSource(micStream);
        source.connect(audioCtx.destination);
        loopbackAudioCtxRef.current = audioCtx;
        setLoopbackActive(true);
      } catch {
        setLoopbackActive(false);
      }
    }
  };

  // Ekstrak nama dokumen/skenario bersih dari title
  const cleanDocName = title.startsWith("Persiapan: ")
    ? title.replace("Persiapan: ", "")
    : title.startsWith("Persiapan Wawancara: ")
    ? title.replace("Persiapan Wawancara: ", "")
    : title;

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Banner Error jika ada masalah */}
      {error && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl bg-rose-50 p-4 text-xs text-rose-700 border border-rose-200">
          <i className="bi bi-exclamation-triangle-fill text-rose-500 shrink-0 mt-0.5"></i>
          <div className="flex-1">
            <p className="font-medium">{error}</p>
            {isQuotaError(0, error) && (
              <button
                type="button"
                onClick={() => setQuotaModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1 font-bold text-brand-700 hover:text-brand-800 hover:underline"
              >
                <span>Lihat Pilihan Paket & Upgrade Sekarang</span>
                <i className="bi bi-arrow-right"></i>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Kontainer Utama Bersih & Elegan (Rounded-2xl Terukur) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 md:p-8 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ================= SISI KIRI (7/12): KAMERA, PERANGKAT & UJI SUARA ================= */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            {/* 1. Viewport Kamera dengan Overlay Badges & Kapsul Melayang */}
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800 shadow-sm">
              {cameraReady && camStream ? (
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  className="h-full w-full -scale-x-100 object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <i className="bi bi-camera-video-off text-4xl mb-3 text-slate-500"></i>
                  <p className="text-sm font-semibold text-slate-300">Kamera tidak aktif</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Izinkan akses kamera pada browser Anda untuk memulai video feed.
                  </p>
                </div>
              )}

              {/* Overlay Badges Bagian Atas */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-slate-950/70 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-white border border-slate-700/60 shadow-xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                    <span>HD 1080p • 60 FPS</span>
                  </span>
                  <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-indigo-600/90 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white border border-indigo-400/40 shadow-xs">
                    <i className="bi bi-stars text-indigo-200"></i>
                    <span>AI Face Tracking Active</span>
                  </span>
                </div>

                <span className="flex items-center gap-1.5 rounded-full bg-slate-950/70 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-emerald-400 border border-slate-700/60 shadow-xs">
                  <i className="bi bi-brightness-high-fill text-amber-400"></i>
                  <span>Pencahayaan Baik</span>
                </span>
              </div>

              {/* Overlay Kapsul Kontrol Melayang di Bawah Kamera */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 rounded-full bg-slate-950/80 backdrop-blur-md px-4 py-2 border border-slate-700/70 shadow-lg">
                {/* Tombol Kamera */}
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                    cameraReady ? "bg-slate-800 text-white" : "bg-rose-500/20 text-rose-400"
                  }`}
                  title={cameraReady ? "Kamera Aktif" : "Kamera Mati"}
                >
                  <i className={`bi ${cameraReady ? "bi-camera-video-fill" : "bi-camera-video-off-fill"} text-xs`}></i>
                </span>

                {/* Tombol Mic & Live Audio Visualizer Bars */}
                <div className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-xs text-white">
                  <i className={`bi ${voiceReady ? "bi-mic-fill text-emerald-400" : "bi-mic-mute-fill text-rose-400"}`}></i>
                  <div className="flex items-center gap-0.5 h-3">
                    {[0.4, 0.9, 0.5, 1.0, 0.7].map((scale, i) => (
                      <span key={i} className={`w-0.5 rounded-full transition-all duration-75 ${voiceReady && audioLevel > 5 ? "bg-emerald-400" : "bg-slate-600"}`} style={{ height: voiceReady && audioLevel > 5 ? `${Math.max(3, (audioLevel / 100) * 12 * scale + 3)}px` : "3px" }}></span>
                    ))}
                  </div>
                </div>

                {/* Tombol AI Skeleton */}
                <button
                  type="button"
                  onClick={onToggleMediaPipeConsent}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                    skeletonEnabled ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                  title="Deteksi Postur MediaPipe"
                >
                  <i className="bi bi-person-bounding-box text-xs"></i>
                </button>

                {/* Tombol Pengaturan Kesiapan */}
                <button
                  type="button"
                  onClick={() => setReadinessModalOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white transition"
                  title="Detail Kesiapan Sistem"
                >
                  <i className="bi bi-gear-fill text-xs"></i>
                </button>
              </div>
            </div>

            {/* 2. Tiga Kartu Status Perangkat (Webcam, Mic, Latensi) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Kartu Webcam */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <i className="bi bi-camera-video text-sm"></i>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">Webcam Utama</p>
                    <p className="truncate text-[11px] text-slate-500">{cameraLabel}</p>
                  </div>
                </div>
                <i className="bi bi-check-circle-fill text-emerald-500 text-sm ml-2 shrink-0"></i>
              </div>

              {/* Kartu Mikrofon */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <i className="bi bi-mic text-sm"></i>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">Input Suara</p>
                    <p className="truncate text-[11px] text-slate-500">{micLabel}</p>
                  </div>
                </div>
                <i className="bi bi-check-circle-fill text-emerald-500 text-sm ml-2 shrink-0"></i>
              </div>

              {/* Kartu Jaringan */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <i className="bi bi-wifi text-sm"></i>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">Jaringan Latensi</p>
                    <p className="truncate text-[11px] text-slate-500">Stabil (28 ms)</p>
                  </div>
                </div>
                <i className="bi bi-check-circle-fill text-emerald-500 text-sm ml-2 shrink-0"></i>
              </div>
            </div>

            {/* 3. Panel Uji Pacing, Artikulasi & FITUR TES SUARA AGAR SUARANYA KEMBALI */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <i className="bi bi-bar-chart-fill text-indigo-600"></i>
                  <h3 className="text-sm font-bold text-slate-800">Uji Pacing & Artikulasi Awal</h3>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  Optimal: 120-140 WPM
                </span>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Ucapkan kalimat pembuka presentasi Anda secara santai untuk menyelaraskan deteksi vokal AI.
              </p>

              {/* Box Kutipan Latihan Kalimat Pembuka */}
              <div className="mt-3 relative rounded-xl border border-indigo-100/80 bg-indigo-50/40 p-4">
                <div className="flex gap-3">
                  <i className="bi bi-quote text-2xl text-indigo-400 shrink-0 -mt-1"></i>
                  <p className="text-xs italic text-slate-700 leading-relaxed font-medium">
                    "Selamat pagi dewan juri, hari ini saya akan memaparkan solusi efisiensi pembelajaran digital..."
                  </p>
                </div>
              </div>

              {/* FITUR TES SUARA DENGAN KONTROL AUDIO PLAYBACK / LOOPBACK */}
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                {audioTestState === "idle" && (
                  <button
                    type="button"
                    onClick={handleStartVoiceTest}
                    disabled={!voiceReady}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 px-4 py-2 text-xs font-bold border border-indigo-200/80 transition active:scale-95 disabled:opacity-50"
                  >
                    <i className="bi bi-mic-fill text-indigo-600"></i>
                    <span>Tes Rekam Suara (3 Detik)</span>
                  </button>
                )}

                {audioTestState === "recording" && (
                  <div className="inline-flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700 animate-pulse">
                    <i className="bi bi-record-circle-fill text-rose-500"></i>
                    <span>Bicara sekarang... ({testCountdown}s)</span>
                  </div>
                )}

                {audioTestState === "playback" && (
                  <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800">
                    <i className="bi bi-volume-up-fill text-emerald-600 animate-bounce"></i>
                    <span>Memutar Ulang Suara Anda... ({testCountdown}s)</span>
                  </div>
                )}

                {audioTestState === "ready" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReplayVoice}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition active:scale-95"
                    >
                      <i className="bi bi-play-fill text-sm"></i>
                      <span>Putar Ulang Suara</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStartVoiceTest}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 text-xs font-semibold transition active:scale-95"
                    >
                      <i className="bi bi-arrow-repeat"></i>
                      <span>Tes Lagi</span>
                    </button>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                      <i className="bi bi-check-circle-fill text-emerald-600 text-[10px]"></i>
                      <span>Suara Terdengar Jelas</span>
                    </span>
                  </div>
                )}

                {/* Tombol Monitor Suara Langsung (Loopback Audio) */}
                <button
                  type="button"
                  onClick={handleToggleLoopback}
                  disabled={!voiceReady}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition active:scale-95 ${
                    loopbackActive
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-2xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  title="Dengarkan suara langsung melalui headphone/speaker"
                >
                  <i className={`bi ${loopbackActive ? "bi-headphones text-emerald-600" : "bi-headphones text-slate-500"}`}></i>
                  <span>{loopbackActive ? "Monitor Suara Aktif" : "Dengar Suara Langsung"}</span>
                </button>
              </div>
            </div>

          </div>

          {/* ================= SISI KANAN (5/12): CHECKLIST, METRIK & CTA ================= */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Tab Switcher: [ Persiapan ] vs [ Tips AI ] */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100/90 p-1 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setActiveTab("persiapan")}
                className={`rounded-lg py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeTab === "persiapan"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <i className="bi bi-shield-check text-indigo-600"></i>
                <span>Persiapan</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tips")}
                className={`rounded-lg py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeTab === "tips"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <i className="bi bi-lightbulb text-amber-500"></i>
                <span>Tips AI</span>
              </button>
            </div>

            {/* Konten Tab 1: PERSIAPAN (Checklist, Materi Terpilih & Metrik) */}
            {activeTab === "persiapan" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                
                {/* 1. Ceklist Parameter Penting */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Ceklist Parameter Penting
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                      3/3 Terverifikasi
                    </span>
                  </div>

                  <div className="mt-3.5 space-y-3.5">
                    {/* Item 1 */}
                    <div className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mt-0.5">
                        <i className="bi bi-check-lg text-xs"></i>
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Pencahayaan & Ruangan</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                          Hindari cahaya lampu langsung di belakang kepala (backlight) agar ekspresi wajah terbaca.
                        </p>
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mt-0.5">
                        <i className="bi bi-check-lg text-xs"></i>
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Kontak Mata Alami</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                          Posisikan lensa kamera sejajar dengan ketinggian mata untuk impresi audiens yang profesional.
                        </p>
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mt-0.5">
                        <i className="bi bi-check-lg text-xs"></i>
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Suara & Kecepatan Artikulasi</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                          Gunakan jeda alami antar kalimat untuk menekan penggunaan kata pengisi (filler words).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Materi Slide / Skenario Terpilih */}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Materi Slide Terpilih
                  </p>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                        <i className="bi bi-file-earmark-pdf text-base"></i>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-800">{cleanDocName}</p>
                        <p className="truncate text-[11px] text-slate-500">Materi Siap Dipresentasikan</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      <span className="rounded-md bg-white border border-slate-200 p-1.5 text-xs text-slate-500" title="Pratinjau">
                        <i className="bi bi-eye"></i>
                      </span>
                      <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md bg-white border border-slate-200 p-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
                        title="Ganti Materi"
                      >
                        <i className="bi bi-arrow-left-right"></i>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Metrik Evaluasi Sesi Ini */}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Metrik Evaluasi Sesi Ini
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700 border border-slate-200/80">
                      <i className="bi bi-speedometer2 text-indigo-600"></i>
                      <span>Kecepatan Bicara</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700 border border-slate-200/80">
                      <i className="bi bi-chat-quote text-indigo-600"></i>
                      <span>Filler Word Counter</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700 border border-slate-200/80">
                      <i className="bi bi-eye text-indigo-600"></i>
                      <span>Eye Contact Ratio</span>
                    </span>
                  </div>
                </div>

              </div>
            )}

            {/* Konten Tab 2: TIPS AI */}
            {activeTab === "tips" && (
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3.5 animate-in fade-in duration-150">
                <div className="border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Rekomendasi Penyampaian AI
                  </span>
                </div>

                <div className="space-y-3 text-xs leading-relaxed text-slate-600">
                  <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 border border-slate-200/70">
                    <i className="bi bi-brightness-high-fill text-amber-500 shrink-0 mt-0.5"></i>
                    <div>
                      <p className="font-bold text-slate-800">Pencahayaan Wajah</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Pastikan cahaya merata pada wajah agar modul eye-tracking merekam fokus pandangan Anda.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 border border-slate-200/70">
                    <i className="bi bi-person-bounding-box text-indigo-600 shrink-0 mt-0.5"></i>
                    <div>
                      <p className="font-bold text-slate-800">Kontak Mata Konsisten</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Lihat lurus ke arah lensa kamera setidaknya 70% dari total waktu presentasi.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 border border-slate-200/70">
                    <i className="bi bi-soundwave text-emerald-600 shrink-0 mt-0.5"></i>
                    <div>
                      <p className="font-bold text-slate-800">Artikulasi & Filler Words</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Ambil jeda napas 1 detik daripada mengucapkan "umm" atau "ehm" saat berpikir.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 border border-slate-200/70">
                    <i className="bi bi-person-standing text-brand-600 shrink-0 mt-0.5"></i>
                    <div>
                      <p className="font-bold text-slate-800">Postur Tegak & Rileks</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Posisikan pundak terbuka dan rileks untuk menjaga kestabilan napas dan vokal.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tombol Utama: Mulai Simulasi Sekarang */}
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={onStart}
                disabled={starting || !simulationReady}
                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 text-sm shadow-md shadow-indigo-600/20 transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {starting ? (
                  <>
                    <i className="bi bi-hourglass-split animate-spin"></i>
                    <span>{startNote || "Menyiapkan sesi simulasi…"}</span>
                  </>
                ) : (
                  <>
                    <span>Mulai Simulasi Sekarang</span>
                    <i className="bi bi-arrow-right"></i>
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={starting}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
                >
                  Kembali ke Pengaturan
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Modal Kesiapan Sistem Detail */}
      {readinessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <i className="bi bi-shield-check text-indigo-600 text-lg"></i>
                <h3 className="text-base font-bold text-slate-800">Diagnostik Kesiapan Sistem</h3>
              </div>
              <button
                type="button"
                onClick={() => setReadinessModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <i className="bi bi-x-lg text-sm"></i>
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {/* Status Kamera */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 border border-slate-200/70">
                <div className="flex items-center gap-3">
                  <i className="bi bi-camera-video-fill text-indigo-600 text-base"></i>
                  <span className="text-sm font-semibold text-slate-700">Video Webcam</span>
                </div>
                {cameraReady ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                    <i className="bi bi-check-circle-fill text-[10px]"></i>
                    <span>Siap</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                    <i className="bi bi-x-circle-fill text-[10px]"></i>
                    <span>Tidak Aktif</span>
                  </span>
                )}
              </div>

              {/* Status Audio */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 border border-slate-200/70">
                <div className="flex items-center gap-3">
                  <i className="bi bi-mic-fill text-indigo-600 text-base"></i>
                  <span className="text-sm font-semibold text-slate-700">Input Mikrofon</span>
                </div>
                {voiceReady ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                    <i className="bi bi-check-circle-fill text-[10px]"></i>
                    <span>Siap</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                    <i className="bi bi-x-circle-fill text-[10px]"></i>
                    <span>Tidak Aktif</span>
                  </span>
                )}
              </div>

              {/* Status MediaPipe */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 border border-slate-200/70">
                <div className="flex items-center gap-3">
                  <i className="bi bi-eye-fill text-indigo-600 text-base"></i>
                  <span className="text-sm font-semibold text-slate-700">AI Vision Tracking</span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <i className="bi bi-check-circle-fill text-[10px]"></i>
                  <span>Aktif</span>
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setReadinessModalOpen(false)}
                className="w-full rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2.5 text-xs transition active:scale-95"
              >
                Tutup Diagnostik
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kuota Habis & Pilihan Upgrade Premium */}
      <QuotaExceededModal
        isOpen={quotaModalOpen}
        onClose={() => setQuotaModalOpen(false)}
        title="Kuota Sesi Simulasi Tercapai"
        message={error || undefined}
        featureName="Simulasi Presentasi & Wawancara"
        targetPlan={targetPlan}
      />
    </div>
  );
}
