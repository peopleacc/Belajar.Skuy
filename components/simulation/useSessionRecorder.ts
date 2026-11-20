"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VisualAnalyzer } from "@/lib/visualAnalysis";
import { SpeechCadenceTracker, type CadenceSnapshot } from "@/lib/speechCadence";

/**
 * useSessionRecorder — Mesin rekam/analisis/unggah yang DIPAKAI BERSAMA presentasi & wawancara.
 *
 * Pembaruan Track 6:
 * - 6A-IB: Isolated Audio Chunk Buffer per Segment (CSR).
 * - 6B-CT: Clean Async MediaRecorder Lifecycle & Zero-Loss Transition.
 * - 6C-LQ: Client-Side Local Upload Queue & Non-Blocking Background Dispatcher:
 *   Mengantrekan pengiriman segmen audio di memori browser dengan auto-retry 2x,
 *   dispatcher asinkron non-blocking, serta metode drain() untuk menjamin seluruh
 *   transkrip segmen tersimpan sebelum scoring.
 */

export type RecorderOptions = {
  /** Batas rekaman per segmen (detik) — standardisasi 120 detik (2 menit) per slide/pertanyaan. */
  maxSegmentSeconds?: number;
  wantVisual: boolean;
  language?: "id" | "en";
};

export type SegmentJobStatus = "queued" | "uploading" | "done" | "failed";

export type SegmentJob = {
  id: string;
  sessionId: string;
  index: number;
  durationMs: number;
  blob: Blob | null;
  visualMetrics: unknown;
  cadenceMetrics: unknown;
  slideImage?: string | null;
  status: SegmentJobStatus;
  retryCount: number;
  error?: string;
};

export type QueueStats = {
  queued: number;
  uploading: number;
  done: number;
  failed: number;
  total: number;
};

/**
 * ClientSegmentQueue — Pengelola antrean pengunggahan segmen audio lokal di sisi browser (CSR).
 * Menghilangkan pemblokiran UI saat berpindah slide/soal dan menjamin keutuhan data sebelum penilaian.
 */
export class ClientSegmentQueue {
  private jobs: SegmentJob[] = [];
  private concurrency: number = 2;
  private activeCount: number = 0;
  private onStatsChange?: (stats: QueueStats) => void;
  private drainResolvers: (() => void)[] = [];

  constructor(options?: {
    concurrency?: number;
    onStatsChange?: (stats: QueueStats) => void;
  }) {
    if (options?.concurrency) this.concurrency = options.concurrency;
    if (options?.onStatsChange) this.onStatsChange = options.onStatsChange;
  }

  public setStatsCallback(cb: (stats: QueueStats) => void): void {
    this.onStatsChange = cb;
  }

  public enqueue(job: Omit<SegmentJob, "status" | "retryCount">): void {
    const fullJob: SegmentJob = {
      ...job,
      status: "queued",
      retryCount: 0,
    };
    this.jobs.push(fullJob);
    console.log(`[ClientSegmentQueue] Enqueued segmen #${job.index} (audio: ${job.blob?.size ?? 0} bytes)`);
    this.notify();
    this.dispatch();
  }

  public getStats(): QueueStats {
    let queued = 0;
    let uploading = 0;
    let done = 0;
    let failed = 0;
    for (const j of this.jobs) {
      if (j.status === "queued") queued++;
      else if (j.status === "uploading") uploading++;
      else if (j.status === "done") done++;
      else if (j.status === "failed") failed++;
    }
    return { queued, uploading, done, failed, total: this.jobs.length };
  }

  private notify(): void {
    if (this.onStatsChange) {
      this.onStatsChange(this.getStats());
    }
  }

  private dispatch(): void {
    while (this.activeCount < this.concurrency) {
      const nextJob = this.jobs.find((j) => j.status === "queued");
      if (!nextJob) break;

      this.activeCount++;
      nextJob.status = "uploading";
      this.notify();

      void this.processJob(nextJob).finally(() => {
        this.activeCount--;
        this.notify();
        this.dispatch();
        this.checkDrain();
      });
    }
  }

  private async processJob(job: SegmentJob): Promise<void> {
    const maxRetries = 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const form = new FormData();
        form.append("sessionId", job.sessionId);
        form.append("index", String(job.index));
        form.append("durationMs", String(job.durationMs));
        if (job.blob && job.blob.size > 0) {
          form.append("audio", job.blob, "segmen.webm");
        }
        if (job.visualMetrics) {
          form.append("visualMetrics", JSON.stringify(job.visualMetrics));
        }
        if (job.cadenceMetrics) {
          form.append("cadenceMetrics", JSON.stringify(job.cadenceMetrics));
        }
        if (job.slideImage) {
          form.append("slideImage", job.slideImage);
        }

        const res = await fetch("/api/simulation/segment", {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          // Jika server mengembalikan HTTP 409 karena sesi sudah selesai (in-flight race condition),
          // jangan throw error/crash UI karena sesi sudah tuntas dinilai di server.
          if (res.status === 409) {
            console.warn(`[ClientSegmentQueue] Sesi sudah selesai di server untuk segmen #${job.index}, menandai job selesai.`);
            job.status = "done";
            return;
          }
          throw new Error(`HTTP ${res.status}: ${JSON.stringify(errData)}`);
        }

        job.status = "done";
        console.log(`[ClientSegmentQueue] Berhasil upload segmen #${job.index}`);
        return;
      } catch (err: unknown) {
        attempt++;
        job.retryCount = attempt;
        job.error = err instanceof Error ? err.message : String(err);
        if (attempt <= maxRetries) {
          console.warn(`[ClientSegmentQueue] Retry #${attempt} untuk segmen #${job.index} dalam 1000ms...`, err);
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          console.error(`[ClientSegmentQueue] Gagal upload segmen #${job.index} setelah ${maxRetries}x percobaan:`, err);
          job.status = "failed";
        }
      }
    }
  }

  private checkDrain(): void {
    const pending = this.jobs.some((j) => j.status === "queued" || j.status === "uploading");
    if (!pending && this.drainResolvers.length > 0) {
      const resolvers = [...this.drainResolvers];
      this.drainResolvers = [];
      resolvers.forEach((res) => res());
    }
  }

  /** Menunggu hingga seluruh antrean segmen mencapai status done atau failed */
  public async drain(timeoutMs: number = 25000): Promise<QueueStats> {
    const pending = this.jobs.some((j) => j.status === "queued" || j.status === "uploading");
    if (!pending) {
      return this.getStats();
    }

    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn("[ClientSegmentQueue] drain() mencapai batas timeout.");
          resolve(this.getStats());
        }
      }, timeoutMs);

      this.drainResolvers.push(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(this.getStats());
        }
      });
    });
  }

  public clear(): void {
    this.jobs = [];
    this.drainResolvers = [];
    this.activeCount = 0;
    this.notify();
  }
}

interface ActiveSegmentContext {
  id: string;
  recorder: MediaRecorder;
  chunks: Blob[];
  startTime: number;
  mimeType: string;
  isHalted: boolean;
  stopPromise: Promise<{ blob: Blob | null; durationMs: number }> | null;
}

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
  const [queueStats, setQueueStats] = useState<QueueStats>({
    queued: 0,
    uploading: 0,
    done: 0,
    failed: 0,
    total: 0,
  });

  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const analyzerRef = useRef<VisualAnalyzer | null>(null);
  const cadenceTrackerRef = useRef<SpeechCadenceTracker | null>(null);
  const analysisVideoRef = useRef<HTMLVideoElement | null>(null);

  // Context terisolasi per segmen (Task 6A-IB)
  const activeSegmentRef = useRef<ActiveSegmentContext | null>(null);
  const pendingRef = useRef<{ blob: Blob | null; durationMs: number } | null>(null);
  const pendingClosePromiseRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Antrean upload lokal di browser (Task 6C-LQ)
  const queueRef = useRef<ClientSegmentQueue | null>(null);
  if (!queueRef.current) {
    queueRef.current = new ClientSegmentQueue({
      concurrency: 2,
      onStatsChange: (stats) => {
        setQueueStats(stats);
        setFailedUploads(stats.failed);
      },
    });
  }

  /**
   * Menghentikan perekam segmen secara asinkron dan aman (Task 6B-CT).
   */
  const haltSegment = useCallback(
    (context: ActiveSegmentContext): Promise<{ blob: Blob | null; durationMs: number }> => {
      if (context.stopPromise) {
        return context.stopPromise;
      }
      context.isHalted = true;
      const durationMs = Math.max(100, Date.now() - context.startTime);
      const recorder = context.recorder;

      if (recorder.state === "inactive") {
        const validBlob =
          context.chunks.length > 0 && context.chunks.some((c) => c.size > 0)
            ? new Blob(context.chunks, { type: context.mimeType || "audio/webm" })
            : null;
        context.stopPromise = Promise.resolve({ blob: validBlob, durationMs });
        return context.stopPromise;
      }

      context.stopPromise = new Promise<{ blob: Blob | null; durationMs: number }>((resolve) => {
        let resolved = false;

        const safetyTimeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.warn(`[useSessionRecorder] Safety timeout onstop untuk segmen [${context.id}]`);
            const fallbackBlob =
              context.chunks.length > 0 && context.chunks.some((c) => c.size > 0)
                ? new Blob(context.chunks, { type: context.mimeType || "audio/webm" })
                : null;
            resolve({ blob: fallbackBlob, durationMs });
          }
        }, 3000);

        recorder.onstop = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(safetyTimeout);
            const validBlob =
              context.chunks.length > 0 && context.chunks.some((c) => c.size > 0)
                ? new Blob(context.chunks, { type: context.mimeType || "audio/webm" })
                : null;
            resolve({ blob: validBlob, durationMs });
          }
        };

        try {
          if (recorder.state === "recording") {
            recorder.requestData();
          }
        } catch {
          /* ignore jika recorder sudah bertransisi */
        }

        try {
          if (recorder.state !== "inactive") {
            recorder.stop();
          }
        } catch (stopErr) {
          console.warn("[useSessionRecorder] Exception pada recorder.stop:", stopErr);
          if (!resolved) {
            resolved = true;
            clearTimeout(safetyTimeout);
            const validBlob =
              context.chunks.length > 0 && context.chunks.some((c) => c.size > 0)
                ? new Blob(context.chunks, { type: context.mimeType || "audio/webm" })
                : null;
            resolve({ blob: validBlob, durationMs });
          }
        }
      });

      return context.stopPromise;
    },
    []
  );

  const releaseMedia = useCallback(() => {
    if (activeSegmentRef.current) {
      try {
        if (activeSegmentRef.current.recorder.state !== "inactive") {
          activeSegmentRef.current.recorder.stop();
        }
      } catch {}
      activeSegmentRef.current = null;
    }
    pendingRef.current = null;

    try {
      micStreamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      camStreamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
    } catch {}
    micStreamRef.current = null;
    camStreamRef.current = null;

    if (analysisVideoRef.current) {
      try {
        analysisVideoRef.current.pause();
        analysisVideoRef.current.srcObject = null;
      } catch {}
      analysisVideoRef.current = null;
    }

    try {
      analyzerRef.current?.stop();
    } catch {}
    analyzerRef.current = null;

    try {
      cadenceTrackerRef.current?.stop();
    } catch {}
    cadenceTrackerRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setVisualState("off");
  }, []);

  useEffect(() => {
    const handleUnload = () => {
      releaseMedia();
    };
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
      releaseMedia();
    };
  }, [releaseMedia]);

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
          onProgress?.("Meminta izin kamera...");
          camStreamRef.current = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
          });
        } catch {
          camStreamRef.current = null;
        }

        if (camStreamRef.current) {
          try {
            const v = document.createElement("video");
            v.muted = true;
            v.playsInline = true;
            v.srcObject = camStreamRef.current;
            await v.play();
            analysisVideoRef.current = v;
            onProgress?.("Memuat model analisis kecerdasan gerak (MediaPipe)...");
            analyzerRef.current = await VisualAnalyzer.create(v);
            visualOk = true;
          } catch (analyzerErr) {
            console.warn(
              "[useSessionRecorder] VisualAnalyzer gagal dimuat, tetapi stream kamera tetap dipertahankan untuk preview:",
              analyzerErr
            );
            analyzerRef.current = null;
          }
        }
      }
      setVisualState(visualOk ? "on" : wantVisual ? "failed" : "off");
      return { micOk, visualOk };
    },
    [wantVisual]
  );

  /**
   * Memulai segmen baru dengan buffer chunks terisolasi (Task 6A-IB).
   */
  const beginSegment = useCallback(() => {
    setSeconds(0);
    setCapped(false);

    if (activeSegmentRef.current && !activeSegmentRef.current.isHalted) {
      void haltSegment(activeSegmentRef.current);
    }
    activeSegmentRef.current = null;
    pendingRef.current = null;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= maxSegmentSeconds) {
          if (activeSegmentRef.current) {
            void haltSegment(activeSegmentRef.current).then((held) => {
              pendingRef.current = held;
            });
          }
          setCapped(true);
          if (timerRef.current) clearInterval(timerRef.current);
          return maxSegmentSeconds;
        }
        return s + 1;
      });
    }, 1000);

    const stream = micStreamRef.current;
    if (stream) {
      let mime = "";
      if (typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mime = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mime = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mime = "audio/mp4";
        }
      }

      try {
        const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        const segmentId = `seg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const localChunks: Blob[] = [];

        rec.ondataavailable = (e: BlobEvent) => {
          if (e.data && e.data.size > 0) {
            localChunks.push(e.data);
          }
        };

        rec.onerror = (e) => {
          console.error(`[useSessionRecorder] MediaRecorder error pada segmen [${segmentId}]:`, e);
        };

        const segContext: ActiveSegmentContext = {
          id: segmentId,
          recorder: rec,
          chunks: localChunks,
          startTime: Date.now(),
          mimeType: mime || rec.mimeType || "audio/webm",
          isHalted: false,
          stopPromise: null,
        };

        activeSegmentRef.current = segContext;
        rec.start(1000);
      } catch (recorderErr) {
        console.error("[useSessionRecorder] Gagal membuat MediaRecorder untuk segmen baru:", recorderErr);
        activeSegmentRef.current = null;
      }
    }

    if (!cadenceTrackerRef.current) {
      cadenceTrackerRef.current = new SpeechCadenceTracker(language);
      cadenceTrackerRef.current.setCallback(setCadence);
    }
    cadenceTrackerRef.current.start();
    analyzerRef.current?.start();
  }, [maxSegmentSeconds, language, haltSegment]);

  /**
   * Tutup segmen aktif: ambil metrik visual + cadence + antrikan ke ClientSegmentQueue (Task 6C-LQ).
   */
  const closeSegment = useCallback(
    (sessionId: string, index: number, slideImage?: string | null): Promise<void> => {
      const visual = analyzerRef.current?.collectSlide() ?? null;
      const cadenceSummary = cadenceTrackerRef.current?.collectSlideCadence() ?? null;

      const segToClose = activeSegmentRef.current;
      activeSegmentRef.current = null;

      let segmentPromise: Promise<{ blob: Blob | null; durationMs: number }>;

      if (pendingRef.current) {
        const held = pendingRef.current;
        pendingRef.current = null;
        segmentPromise = Promise.resolve(held);
      } else if (segToClose) {
        segmentPromise = haltSegment(segToClose);
      } else {
        segmentPromise = Promise.resolve({ blob: null, durationMs: 0 });
      }

      // Masukkan ke antrean upload lokal peramban (non-blocking)
      const closePromise = segmentPromise.then(({ blob, durationMs }) => {
        queueRef.current?.enqueue({
          id: `job_${sessionId}_${index}_${Date.now()}`,
          sessionId,
          index,
          durationMs,
          blob,
          visualMetrics: visual,
          cadenceMetrics: cadenceSummary,
          slideImage,
        });
      });

      pendingClosePromiseRef.current = closePromise;
      return closePromise;
    },
    [haltSegment]
  );

  /**
   * Tunggu seluruh antrean pengunggahan tuntas (drain), lalu lepas resource media (Task 6C-LQ).
   */
  const finalize = useCallback(async () => {
    // 1. Tunggu proses close segmen terakhir selesai meng-enqueue job ke antrean upload
    if (pendingClosePromiseRef.current) {
      try {
        await pendingClosePromiseRef.current;
      } catch {}
      pendingClosePromiseRef.current = null;
    }

    // 2. Hentikan segmen aktif bila masih tersisa
    if (activeSegmentRef.current) {
      await haltSegment(activeSegmentRef.current);
    }

    // 3. Tunggu seluruh segmen yang sedang mengantre atau diunggah selesai (Task 6C-LQ)
    if (queueRef.current) {
      console.log("[useSessionRecorder] Memulai drain() antrean upload segmen...");
      const finalStats = await queueRef.current.drain();
      console.log("[useSessionRecorder] drain() selesai dengan statistik:", finalStats);
    }
    releaseMedia();
  }, [haltSegment, releaseMedia]);

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
    queueStats,
    queue: queueRef.current,
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
