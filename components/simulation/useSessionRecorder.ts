"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VisualAnalyzer } from "@/lib/visualAnalysis";
import { SpeechCadenceTracker, type CadenceSnapshot } from "@/lib/speechCadence";

/**
 * useSessionRecorder — Mesin rekam/analisis/unggah yang DIPAKAI BERSAMA presentasi & wawancara.
 *
 * Pembaruan Update 19:
 * 1. Mengintegrasikan SpeechCadenceTracker untuk live streaming Words Per Second (WPS) & WPM.
 * 2. Mengintegrasikan canvas overlay untuk visual kerangka pose & retikel iris (formula-web.md).
 * 3. Menyertakan cadenceMetrics bersama visualMetrics pada form data per segmen.
 */

export type RecorderOptions = {
  /** Batas rekaman per segmen (detik) — standardisasi 120 detik (2 menit) per slide/pertanyaan. */
  maxSegmentSeconds?: number;
  wantVisual: boolean;
  language?: "id" | "en";
};

export function useSessionRecorder({
  maxSegmentSeconds = 120,
  wantVisual,
  language = "id",
}: RecorderOptions) {
  const [seconds, setSeconds] = useState(0);
  const [noMic, setNoMic] = useState(false);
  const [capped, setCapped] = useState(false);
  const [failedUploads, setFailedUploads] = useState(0);
  const [visualState, setVisualState] = useState<"off" | "on" | "failed">("off");
  const [cadence, setCadence] = useState<CadenceSnapshot | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const analyzerRef = useRef<VisualAnalyzer | null>(null);
  const cadenceTrackerRef = useRef<SpeechCadenceTracker | null>(null);
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
    cadenceTrackerRef.current?.stop();
    cadenceTrackerRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => releaseMedia, [releaseMedia]);

  /** Sambungkan canvas overlay ke VisualAnalyzer untuk visual skeleton */
  const setOverlayCanvas = useCallback(
    (canvas: HTMLCanvasElement | null, skeletonEnabled: boolean) => {
      analyzerRef.current?.setOverlay(canvas, skeletonEnabled);
    },
    []
  );

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
          const v = document.createElement("video");
          v.muted = true;
          v.playsInline = true;
          v.srcObject = camStreamRef.current;
          await v.play();
          analysisVideoRef.current = v;
          onProgress?.("Memuat model analisis kecerdasan gerak (MediaPipe)…");
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
    if (stream) {
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
    }

    // Inisialisasi & jalankan tracker cadence realtime
    if (!cadenceTrackerRef.current) {
      cadenceTrackerRef.current = new SpeechCadenceTracker(language);
      cadenceTrackerRef.current.setCallback(setCadence);
    }
    cadenceTrackerRef.current.start();

    // Jalankan analyzer visual
    analyzerRef.current?.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxSegmentSeconds, language]);

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
   * Tutup segmen aktif: ambil metrik visual + cadence + antrikan unggahan (paralel).
   */
  const closeSegment = useCallback(
    (sessionId: string, index: number, slideImage?: string | null) => {
      const visual = analyzerRef.current?.collectSlide() ?? null;
      const cadenceSummary = cadenceTrackerRef.current?.collectSlideCadence() ?? null;

      uploadsRef.current.push(
        haltRecorder().then(async ({ blob, durationMs }) => {
          const form = new FormData();
          form.append("sessionId", sessionId);
          form.append("index", String(index));
          form.append("durationMs", String(durationMs));
          if (blob && blob.size > 0) form.append("audio", blob, "segmen.webm");
          if (visual) form.append("visualMetrics", JSON.stringify(visual));
          if (cadenceSummary) form.append("cadenceMetrics", JSON.stringify(cadenceSummary));
          if (slideImage) form.append("slideImage", slideImage);
          try {
            const res = await fetch("/api/simulation/segment", { method: "POST", body: form });
            if (!res.ok) setFailedUploads((n) => n + 1);
          } catch {
            setFailedUploads((n) => n + 1);
          }
        })
      );
    },
    []
  );

  /** Tunggu semua unggahan selesai lalu lepas kamera/mikrofon. */
  const finalize = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    analyzerRef.current?.stop();
    analyzerRef.current = null;
    cadenceTrackerRef.current?.stop();
    cadenceTrackerRef.current = null;
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
    cadence,
    camStreamRef,
    micStreamRef,
    setOverlayCanvas,
    prepareMedia,
    beginSegment,
    closeSegment,
    finalize,
    releaseMedia,
  };
}
