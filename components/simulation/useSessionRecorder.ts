"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VisualAnalyzer } from "@/lib/visualAnalysis";

/**
 * Fitur BE — mesin rekam/analisis/unggah yang DIPAKAI BERSAMA presentasi & wawancara.
 *
 * Diekstrak dari SessionRunner (Batch 1-2) tanpa mengubah perilakunya: izin sekali di
 * awal, rekam per segmen, cap durasi menahan blob sampai pindah segmen, metrik visual
 * dikumpulkan tepat di batas segmen, unggah paralel. Kalau ini disalin jadi dua versi,
 * perbaikan di satu sisi tidak akan sampai ke sisi lain — persis masalah yang sudah
 * pernah terjadi di project ini (rebalanceQuizTypes vs sanitizeQuizTypes, Fitur T).
 */

export type RecorderOptions = {
  /** Batas rekaman per segmen (detik). Presentasi 5 menit, wawancara 3 menit. */
  maxSegmentSeconds: number;
  wantVisual: boolean;
};

export function useSessionRecorder({ maxSegmentSeconds, wantVisual }: RecorderOptions) {
  const [seconds, setSeconds] = useState(0);
  const [noMic, setNoMic] = useState(false);
  const [capped, setCapped] = useState(false);
  const [failedUploads, setFailedUploads] = useState(0);
  const [visualState, setVisualState] = useState<"off" | "on" | "failed">("off");

  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const analyzerRef = useRef<VisualAnalyzer | null>(null);
  const analysisVideoRef = useRef<HTMLVideoElement | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pendingRef = useRef<{ blob: Blob | null; durationMs: number } | null>(null);
  const segmentStartRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadsRef = useRef<Promise<void>[]>([]);

  const releaseMedia = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    analyzerRef.current?.stop();
    analyzerRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => releaseMedia, [releaseMedia]);

  /** Minta izin mikrofon & (opsional) kamera + muat model. Gagal ≠ batal. */
  const prepareMedia = useCallback(
    async (onProgress?: (note: string) => void) => {
      let micOk = false;
      try {
        onProgress?.("Meminta izin mikrofon…");
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        micOk = true;
      } catch {
        micOk = false;
      }
      setNoMic(!micOk);

      let visualOk = false;
      if (wantVisual) {
        try {
          onProgress?.("Meminta izin kamera…");
          camStreamRef.current = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
          });
          // Video analisis DI LUAR React tree — elemen JSX ke-remount saat ganti
          // fase dan itu melepas stream dari analyzer (bug nyata di Batch 2).
          const v = document.createElement("video");
          v.muted = true;
          v.playsInline = true;
          v.srcObject = camStreamRef.current;
          await v.play();
          analysisVideoRef.current = v;
          onProgress?.("Memuat model analisis (sekali, beberapa detik)…");
          analyzerRef.current = await VisualAnalyzer.create(v);
          visualOk = true;
        } catch {
          camStreamRef.current?.getTracks().forEach((t) => t.stop());
          camStreamRef.current = null;
          analyzerRef.current = null;
        }
      }
      setVisualState(visualOk ? "on" : wantVisual ? "failed" : "off");
      return { micOk, visualOk };
    },
    [wantVisual]
  );

  const beginSegment = useCallback(() => {
    setSeconds(0);
    setCapped(false);
    segmentStartRef.current = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= maxSegmentSeconds) {
          // Batas tercapai: rekaman dihentikan & DITAHAN (bukan diunggah), supaya
          // unggahannya tetap satu kali bersama metrik visual saat pindah segmen.
          void haltRecorder().then((held) => {
            pendingRef.current = held;
          });
          setCapped(true);
          if (timerRef.current) clearInterval(timerRef.current);
          return maxSegmentSeconds;
        }
        return s + 1;
      });
    }, 1000);

    const stream = micStreamRef.current;
    if (!stream) return; // tanpa mic: hanya timer yang berjalan
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = rec;
    rec.start();
    analyzerRef.current?.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxSegmentSeconds]);

  function haltRecorder(): Promise<{ blob: Blob | null; durationMs: number }> {
    if (pendingRef.current) {
      const held = pendingRef.current;
      pendingRef.current = null;
      return Promise.resolve(held);
    }
    const durationMs = Date.now() - segmentStartRef.current;
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      return new Promise((resolve) => {
        rec.onstop = () =>
          resolve({
            blob: new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }),
            durationMs,
          });
        rec.stop();
      });
    }
    return Promise.resolve({ blob: null, durationMs });
  }

  /**
   * Tutup segmen aktif: ambil metrik visual + antrikan unggahan (paralel).
   * `slideImage` (Fitur DB) — base64 gambar halaman PDF slide ini, opsional (cuma
   * presentasi yang punya; wawancara tidak mengirimnya sama sekali).
   */
  const closeSegment = useCallback((sessionId: string, index: number, slideImage?: string | null) => {
    // collectSlide() JUGA me-reset akumulator — wajib dipanggil tepat di batas segmen.
    const visual = analyzerRef.current?.collectSlide() ?? null;
    uploadsRef.current.push(
      haltRecorder().then(async ({ blob, durationMs }) => {
        const form = new FormData();
        form.append("sessionId", sessionId);
        form.append("index", String(index));
        form.append("durationMs", String(durationMs));
        if (blob && blob.size > 0) form.append("audio", blob, "segmen.webm");
        if (visual) form.append("visualMetrics", JSON.stringify(visual));
        if (slideImage) form.append("slideImage", slideImage);
        try {
          const res = await fetch("/api/simulation/segment", { method: "POST", body: form });
          if (!res.ok) setFailedUploads((n) => n + 1);
        } catch {
          setFailedUploads((n) => n + 1);
        }
      })
    );
  }, []);

  /** Tunggu semua unggahan selesai lalu lepas kamera/mikrofon. */
  const finalize = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    analyzerRef.current?.stop();
    analyzerRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    await Promise.allSettled(uploadsRef.current);
  }, []);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;

  return {
    seconds,
    mmss,
    noMic,
    capped,
    failedUploads,
    visualState,
    camStreamRef,
    micStreamRef,
    prepareMedia,
    beginSegment,
    closeSegment,
    finalize,
    releaseMedia,
  };
}
