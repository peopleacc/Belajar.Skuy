"use client";

import { useEffect, useRef } from "react";
import { VoiceFrequency } from "@/components/simulation/VoiceFrequency";

interface PreparationScreenProps {
  title?: string;
  subtitle?: string;
  camStream: MediaStream | null;
  micStream: MediaStream | null;
  cameraReady: boolean;
  voiceReady: boolean;
  simulationReady: boolean;
  skeletonEnabled?: boolean;
  starting?: boolean;
  startNote?: string;
  onStart: () => void;
  onCancel: () => void;
}

/**
 * Halaman Persiapan Simulasi Mandiri (phase === "preparing") — BUKAN Modal.
 * Menampilkan status kesiapan Camera, Voice, dan Simulasi secara to-the-point
 * dengan tombol Start Simulasi untuk memulai sesi resmi.
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
  starting = false,
  startNote = "",
  onStart,
  onCancel,
}: PreparationScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && camStream) {
      videoRef.current.srcObject = camStream;
      void videoRef.current.play().catch(() => {});
    }
  }, [camStream]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
            Fase Persiapan
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={starting}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          ← Kembali ke Pengaturan
        </button>
      </div>

      {/* Grid 2 Kolom Sesuai Wireframe Gambar 1 */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.8fr_1fr]">
        {/* ================= KOLOM KIRI ================= */}
        <div className="flex flex-col gap-5">
          {/* Kotak Atas: Kamera Besar */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-base shadow-sm">
                  📷
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800">Preview Kamera</p>
                  <p className="text-[11px] text-slate-500">Posisikan wajah Anda tegak di tengah layar</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {skeletonEnabled && cameraReady && (
                  <span className="hidden sm:inline-flex rounded-md bg-purple-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    Visual Kerangka Aktif
                  </span>
                )}
                {cameraReady ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    ● Siap
                  </span>
                ) : (
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                    ○ Mati
                  </span>
                )}
              </div>
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-inner">
              {cameraReady && camStream ? (
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="h-full w-full -scale-x-100 object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                  <i className="bi bi-camera-video-off text-3xl mb-2" />
                  <span className="text-xs">Kamera tidak aktif atau izin belum diberikan</span>
                </div>
              )}

              {skeletonEnabled && cameraReady && (
                <span className="sm:hidden absolute top-2 left-2 rounded-md bg-purple-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  Kerangka Aktif
                </span>
              )}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              {cameraReady
                ? "✓ Wajah Anda terdeteksi. Pastikan ruangan memiliki pencahayaan cukup dan mata sejajar lensa."
                : "⚠️ Izin kamera belum diberikan atau kamera sedang digunakan aplikasi lain."}
            </p>
          </div>

          {/* Kotak Bawah: Tombol Mulai Presentasi / Aksi Sesi */}
          <div className="rounded-xl border border-brand-200/80 bg-gradient-to-r from-brand-50/80 via-white to-brand-50/40 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-800">Sudah Siap Memulai?</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Klik tombol mulai untuk mengaktifkan sesi resmi dan membuka slide/pertanyaan pertama.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={starting}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  ← Kembali
                </button>
                <button
                  type="button"
                  onClick={onStart}
                  disabled={starting}
                  className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
                >
                  {starting ? `⏳ ${startNote || "Menyiapkan sesi…"}` : "🚀 Mulai Presentasi / Simulasi"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ================= KOLOM KANAN ================= */}
        <div className="flex flex-col gap-5">
          {/* Kartu Atas: Timer & Persiapan Kamera / Fokus */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-base shadow-sm">
                    ⏱️
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Timer & Analisis Kamera</p>
                    <p className="text-[11px] text-slate-500">Konfigurasi batas waktu & sensor</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-slate-200/70">
                  <span className="text-slate-600">Batas Waktu Segmen:</span>
                  <span className="font-bold text-brand-600">Maks 2:00 Menit</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-slate-200/70">
                  <span className="text-slate-600">Sensor Fokus Mata:</span>
                  <span className="font-semibold text-emerald-600">Terkalibrasi</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-slate-200/70">
                  <span className="text-slate-600">Pelacak Tempo WPS:</span>
                  <span className="font-semibold text-slate-800">Aktif Real-time</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-slate-200/70">
                  <span className="text-slate-600">Kesiapan Simulasi:</span>
                  <span className={simulationReady ? "font-bold text-emerald-600" : "font-bold text-amber-600"}>
                    {simulationReady ? "● Siap Dijalankan" : "⏳ Memuat Materi"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-blue-50/60 p-2.5 border border-blue-100 text-[11px] text-blue-700">
              💡 <strong>Tips:</strong> Tatap langsung ke arah lensa kamera untuk memaksimalkan skor kontak mata Anda.
            </div>
          </div>

          {/* Kartu Bawah: Persiapan Suara dll */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-base shadow-sm">
                    🎙️
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Persiapan Suara</p>
                    <p className="text-[11px] text-slate-500">Uji sensitivitas mikrofon Anda</p>
                  </div>
                </div>
                {voiceReady ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    ● Siap
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                    ○ Tanpa Mic
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Gelombang Frekuensi Suara
                  </p>
                  <span className="text-[10px] text-slate-400">Live Input</span>
                </div>
                {micStream ? (
                  <VoiceFrequency stream={micStream} variant="inline" />
                ) : (
                  <p className="py-4 text-center text-xs text-slate-400">Mikrofon tidak terhubung</p>
                )}
              </div>
            </div>

            <p className="mt-4 text-[11px] text-slate-500">
              {voiceReady
                ? "Cobalah berbicara beberapa kata untuk memastikan grafik gelombang di atas bergerak."
                : "Mikrofon tidak aktif — sesi akan berlangsung tanpa analisis lisan."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
