// Fitur BC, Pembaruan Update 19 & Task 2A-MO / 2B-HS — Analisis Visual MURNI CLIENT-SIDE di Browser.
//
// Menerapkan seluruh spesifikasi matematis dari `formula-web.md` dengan optimasi performa tinggi:
// 1. GazeDynamicsEngine: Koordinat iris rongga mata (Eye-Socket Invariant), titik konjugat P_eye,
//    filter deadzone 0.012, saccade 0.038, refractory debounce 200ms, sliding buffers (3s, 5s, 60s),
//    klasifikasi (Kecurigaan Membaca Teks, Tidak Fokus, Memperhatikan Audiens, Fokus, Netral).
// 2. Simple Macro Hand Kinematics (Task 2B-HS):
//    Mengeliminasi model HandLandmarker 21-sendi jari mandiri (~15MB & high CPU), beralih ke deteksi
//    kehadiran tangan makro memanfaatkan koordinat pergelangan tangan (wrist #15 & #16) dan jari dari
//    PoseLandmarkerLite, dinormalisasi terhadap lebar bahu s_shoulder.
// 3. Performance Optimizer (Task 2A-MO):
//    - Offscreen downscaled canvas 320x240 untuk komputasi inferensi ML hemat CPU/GPU hingga 50-70%.
//    - Frame rate throttling terkontrol pada interval ~85-100ms (10–12 FPS).
// 4. Canvas HUD Renderer: Visual kerangka tubuh, indikator tangan makro siber, dan retikel iris mata.
//
// Zero Server GPU/CPU — 100% privasi di browser klien.

export type GazeClassification = "reading" | "unfocused" | "audience" | "focus" | "neutral";
export type HandClassification = "natural" | "static" | "flailing" | "crossed" | "below_hip";

export type VisualSlideMetrics = {
  // ── Indikator 4 & 5 Baru (formula-web.md & planning-update-19.md) ──
  eyeScore: number; // 10 - 100
  handScore: number; // 10 - 100
  gazeFocusPct: number; // 0 - 100
  gazeAudiencePct: number; // 0 - 100
  gazeUnfocusedPct: number; // 0 - 100
  readingSuspicion: boolean;
  totalEyeShifts: number;
  handNaturalPct: number; // 0 - 100
  handStaticPct: number; // 0 - 100
  handCrossedPct: number; // 0 - 100
  handBelowHipPct: number; // 0 - 100

  // ── Backward-Compatibility Fields ──
  eyeContactRatio: number | null;
  postureScore: number | null;
  expressionVariety: number | null;
  gestureRate: number | null; // gerakan per menit
  framesSampled: number;
  timeline: {
    t: number;
    eye: number | null;
    posture: number | null;
    gesture: number | null;
    gazeState?: GazeClassification;
    handState?: HandClassification;
  }[];
};

const WASM_PATH = "/mediapipe/wasm";
const MODELS = {
  face: "/mediapipe/models/face_landmarker.task",
  pose: "/mediapipe/models/pose_landmarker_lite.task",
};

const BUCKET_MS = 10_000;

type Landmarkers = {
  face: import("@mediapipe/tasks-vision").FaceLandmarker;
  pose: import("@mediapipe/tasks-vision").PoseLandmarker;
};

type Bucket = {
  frames: number;
  eyeOk: number;
  postureOk: number;
  gestureActive: number;
  gazeCounts: Record<GazeClassification, number>;
  handCounts: Record<HandClassification, number>;
};

let benignWasmLogsSuppressed = false;
function suppressBenignWasmLogs() {
  if (benignWasmLogsSuppressed) return;
  benignWasmLogsSuppressed = true;
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (/XNNPACK delegate|TensorFlow Lite/i.test(msg)) return;
    originalError(...args);
  };
}

export class VisualAnalyzer {
  private video: HTMLVideoElement;
  private lm: Landmarkers;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private intervalMs = 90; // ~10-12 FPS
  private detectEma = 0;

  // Offscreen Downscaled Canvas (Task 2A-MO: 320x240 untuk inferensi ringan hemat daya)
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private lastDetectTimestamp = 0;
  private isProcessing = false;

  // Canvas Overlay Renderer (Opsional untuk Skeleton & HUD)
  private overlayCanvas: HTMLCanvasElement | null = null;
  private skeletonEnabled = false;

  // ── Akumulator Slide Berjalan ──
  private frames = 0;
  private slideStart = 0;
  private buckets: Bucket[] = [];

  // ── Gaze Dynamics Engine State ──
  private prevEyePos: { x: number; y: number } | null = null;
  private lastShiftTimestamp = 0;
  private lastMovementTimestamp = 0;
  private totalShiftCount = 0;
  private shiftEvents: { timestamp: number; displacement: number }[] = [];
  private currentGazeState: GazeClassification = "neutral";
  private isShiftingNow = false;

  private gazeCounts: Record<GazeClassification, number> = {
    reading: 0,
    unfocused: 0,
    audience: 0,
    focus: 0,
    neutral: 0,
  };

  // ── Macro Hand Kinematics Engine State (Task 2B-HS) ──
  private prevHandPos: { x: number; y: number } | null = null;
  private handRingBuffer: { vt: number; pos: { x: number; y: number } }[] = [];
  private currentHandState: HandClassification = "static";

  private handCounts: Record<HandClassification, number> = {
    natural: 0,
    static: 0,
    flailing: 0,
    crossed: 0,
    below_hip: 0,
  };

  // ── Posture & Smile Compatibility State ──
  private poseSeen = 0;
  private postureOk = 0;
  private smileVals: number[] = [];

  // Landmark caching untuk render frame overlay
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private lastFaceLandmarks: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private lastPoseLandmarks: any = null;

  private constructor(video: HTMLVideoElement, lm: Landmarkers) {
    this.video = video;
    this.lm = lm;
  }

  /**
   * Inisialisasi model MediaPipe Vision.
   * Mengeliminasi unduhan hand_landmarker.task untuk menghemat ~15 MB memori & CPU (Task 2A-MO).
   */
  static async create(video: HTMLVideoElement): Promise<VisualAnalyzer> {
    suppressBenignWasmLogs();
    const { FilesetResolver, FaceLandmarker, PoseLandmarker } = await import(
      "@mediapipe/tasks-vision"
    );
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const common = { runningMode: "VIDEO" as const };
    const [face, pose] = await Promise.all([
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODELS.face },
        ...common,
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      }),
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODELS.pose },
        ...common,
        numPoses: 1,
      }),
    ]);
    return new VisualAnalyzer(video, { face, pose });
  }

  /** Sambungkan canvas overlay dan aktifkan/nonaktifkan kerangka */
  setOverlay(canvas: HTMLCanvasElement | null, skeletonEnabled: boolean) {
    this.overlayCanvas = canvas;
    this.skeletonEnabled = skeletonEnabled;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startSlide();
    this.loop();
  }

  startSlide() {
    this.frames = 0;
    this.poseSeen = 0;
    this.postureOk = 0;
    this.smileVals = [];
    this.slideStart = performance.now();
    this.buckets = [];

    this.prevEyePos = null;
    this.lastShiftTimestamp = performance.now();
    this.lastMovementTimestamp = performance.now();
    this.totalShiftCount = 0;
    this.shiftEvents = [];
    this.currentGazeState = "neutral";
    this.isShiftingNow = false;
    this.gazeCounts = { reading: 0, unfocused: 0, audience: 0, focus: 0, neutral: 0 };

    this.prevHandPos = null;
    this.handRingBuffer = [];
    this.currentHandState = "static";
    this.handCounts = { natural: 0, static: 0, flailing: 0, crossed: 0, below_hip: 0 };
  }

  /**
   * Rangkum metrik visual slide/segmen berjalan mengacu pada formula-web.md & planning-update-19.md
   */
  collectSlide(): VisualSlideMetrics {
    const totalFrames = Math.max(1, this.frames);
    const elapsedMin = Math.max(0.01, (performance.now() - this.slideStart) / 60000);

    // Rasio Mata
    const focusRatio = this.gazeCounts.focus / totalFrames;
    const audienceRatio = this.gazeCounts.audience / totalFrames;
    const unfocusedRatio = this.gazeCounts.unfocused / totalFrames;
    const readingSuspicion =
      this.gazeCounts.reading > 0 || this.gazeCounts.reading / totalFrames > 0.4;
    const penaltyReading = readingSuspicion ? 2.5 : 0;

    // Skor Dinamika Bola Mata (formula-web.md §4.1, skala 1.0 - 10.0 dikali 10)
    const rawEye =
      3.0 + 4.5 * focusRatio + 3.0 * audienceRatio - 4.5 * unfocusedRatio - penaltyReading;
    const eyeScore = Math.round(Math.min(10.0, Math.max(1.0, rawEye)) * 10);

    // Rasio Tangan (Macro Hand Presence)
    const naturalRatio = this.handCounts.natural / totalFrames;
    const staticRatio = this.handCounts.static / totalFrames;
    const crossedRatio = this.handCounts.crossed / totalFrames;
    const belowHipRatio = this.handCounts.below_hip / totalFrames;

    // Skor Dinamika Gestur Tangan (formula-web.md §4.2, skala 1.0 - 10.0 dikali 10)
    const rawHand = 2.5 + 7.5 * naturalRatio - 3.0 * crossedRatio - 2.0 * belowHipRatio;
    const handScore = Math.round(Math.min(10.0, Math.max(1.0, rawHand)) * 10);

    const metrics: VisualSlideMetrics = {
      eyeScore,
      handScore,
      gazeFocusPct: Math.round(focusRatio * 100),
      gazeAudiencePct: Math.round(audienceRatio * 100),
      gazeUnfocusedPct: Math.round(unfocusedRatio * 100),
      readingSuspicion,
      totalEyeShifts: this.totalShiftCount,
      handNaturalPct: Math.round(naturalRatio * 100),
      handStaticPct: Math.round(staticRatio * 100),
      handCrossedPct: Math.round(crossedRatio * 100),
      handBelowHipPct: Math.round(belowHipRatio * 100),

      // Kompatibilitas lama
      eyeContactRatio: round2((this.gazeCounts.focus + this.gazeCounts.audience) / totalFrames),
      postureScore: this.poseSeen > 0 ? round2(this.postureOk / this.poseSeen) : null,
      expressionVariety:
        this.smileVals.length > 3 ? round2(Math.min(1, stddev(this.smileVals) * 2)) : null,
      gestureRate: round2(this.handCounts.natural / elapsedMin),
      framesSampled: this.frames,
      timeline: this.buckets.map((b, i) => {
        const bf = Math.max(1, b.frames);
        return {
          t: i * (BUCKET_MS / 1000),
          eye: round2((b.gazeCounts.focus + b.gazeCounts.audience) / bf),
          posture: round2(b.postureOk / bf),
          gesture: round2(b.gestureActive / bf),
        };
      }),
    };

    this.startSlide();
    return metrics;
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    try {
      this.lm.face.close();
      this.lm.pose.close();
    } catch {
      /* ignore cleanup */
    }
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
  }

  private loop() {
    if (!this.running) return;
    const t0 = performance.now();
    try {
      this.sample(t0);
      if (this.overlayCanvas) {
        this.drawOverlay();
      }
    } catch {
      /* skip frame */
    }
    const cost = performance.now() - t0;
    this.detectEma = this.detectEma === 0 ? cost : this.detectEma * 0.8 + cost * 0.2;
    // Frame Throttling: Cap interval minimal di 85ms (~11-12 FPS) untuk efisiensi CPU (Task 2A-MO)
    this.intervalMs = Math.max(85, Math.min(220, Math.round(this.detectEma * 1.4)));
    this.timer = setTimeout(() => this.loop(), this.intervalMs);
  }

  private bucket(): Bucket {
    const i = Math.min(119, Math.floor((performance.now() - this.slideStart) / BUCKET_MS));
    while (this.buckets.length <= i) {
      this.buckets.push({
        frames: 0,
        eyeOk: 0,
        postureOk: 0,
        gestureActive: 0,
        gazeCounts: { reading: 0, unfocused: 0, audience: 0, focus: 0, neutral: 0 },
        handCounts: { natural: 0, static: 0, flailing: 0, crossed: 0, below_hip: 0 },
      });
    }
    return this.buckets[i];
  }

  private sample(ts: number) {
    if (this.video.readyState < 2 || this.isProcessing) return;

    // Frame Throttling Guard
    const now = performance.now();
    if (now - this.lastDetectTimestamp < 80) return;
    this.lastDetectTimestamp = now;

    const b = this.bucket();
    this.frames += 1;
    b.frames += 1;

    // ── Offscreen Downscaled Canvas (320x240) — Task 2A-MO ──
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement("canvas");
      this.offscreenCanvas.width = 320;
      this.offscreenCanvas.height = 240;
      this.offscreenCtx = this.offscreenCanvas.getContext("2d", { willReadFrequently: true });
    }

    if (this.offscreenCtx && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
      this.offscreenCtx.drawImage(this.video, 0, 0, 320, 240);
    }

    const inputSource = this.offscreenCanvas ?? this.video;
    this.isProcessing = true;

    try {
      // ── 1. MediaPipe Vision Tasks Inferences (Face & Pose Lite Saja) ──
      const faceResult = this.lm.face.detectForVideo(inputSource, ts);
      const poseResult = this.lm.pose.detectForVideo(inputSource, ts);

      this.lastFaceLandmarks = faceResult.faceLandmarks?.[0] ?? null;
      this.lastPoseLandmarks = poseResult.landmarks?.[0] ?? null;

      // ── 2. GAZE DYNAMICS ENGINE (formula-web.md §2) ──
      const fl = this.lastFaceLandmarks;
      if (
        fl &&
        fl[33] &&
        fl[133] &&
        fl[159] &&
        fl[145] &&
        fl[468] &&
        fl[263] &&
        fl[362] &&
        fl[386] &&
        fl[374] &&
        fl[473]
      ) {
        // Mata Kanan (Right Eye Canthi & Iris 468)
        const wR = Math.abs(fl[133].x - fl[33].x) || 1e-5;
        const hR = Math.abs(fl[145].y - fl[159].y) || 1e-5;
        const relXR = (fl[468].x - fl[33].x) / wR;
        const relYR = (fl[468].y - fl[159].y) / hR;

        // Mata Kiri (Left Eye Canthi & Iris 473)
        const wL = Math.abs(fl[263].x - fl[362].x) || 1e-5;
        const hL = Math.abs(fl[374].y - fl[386].y) || 1e-5;
        const relXL = (fl[473].x - fl[362].x) / wL;
        const relYL = (fl[473].y - fl[386].y) / hL;

        // Posisi Konjugat P_eye(t)
        const currEyePos = {
          x: (relXR + relXL) / 2,
          y: (relYR + relYL) / 2,
        };

        if (this.prevEyePos) {
          const deltaP = Math.hypot(
            currEyePos.x - this.prevEyePos.x,
            currEyePos.y - this.prevEyePos.y
          );
          // Filter Deadzone 0.012
          const deltaPActive = Math.max(0.0, deltaP - 0.012);
          // Ambang Saccade 0.038
          this.isShiftingNow = deltaPActive >= 0.038;

          if (this.isShiftingNow) {
            // Debounce Refractory 200ms
            if (now - this.lastShiftTimestamp > 200) {
              this.shiftEvents.push({ timestamp: now, displacement: deltaPActive });
              this.lastShiftTimestamp = now;
              this.totalShiftCount += 1;
              this.lastMovementTimestamp = now;
            }
          }
        }
        this.prevEyePos = currEyePos;

        // Durasi diam tanpa pergeseran aktif
        const staticDurationSec = (now - this.lastMovementTimestamp) / 1000;

        // Bersihkan riwayat melebihi 60 detik
        this.shiftEvents = this.shiftEvents.filter((ev) => now - ev.timestamp <= 60000);

        // Window counts: 3s, 5s, 60s
        const n3s = this.shiftEvents.filter((ev) => now - ev.timestamp <= 3000).length;
        const n5s = this.shiftEvents.filter((ev) => now - ev.timestamp <= 5000).length;
        const n60s = this.shiftEvents.length;

        // Pohon Keputusan Klasifikasi (formula-web.md §2.4)
        if (staticDurationSec >= 300) {
          this.currentGazeState = "reading"; // Kecurigaan membaca teks
        } else if (n3s >= 10) {
          this.currentGazeState = "unfocused"; // Tidak fokus / gerak sangat cepat
        } else if (n5s >= 5) {
          this.currentGazeState = "audience"; // Memperhatikan audiens
        } else if (n60s <= 2) {
          this.currentGazeState = "focus"; // Fokus tenang
        } else {
          this.currentGazeState = "neutral";
        }

        this.gazeCounts[this.currentGazeState] += 1;
        b.gazeCounts[this.currentGazeState] += 1;
      }

      // Variasi Ekspresi (Smile Blendshapes)
      const shapes = faceResult.faceBlendshapes?.[0]?.categories;
      if (shapes) {
        const smileL = shapes.find((c) => c.categoryName === "mouthSmileLeft")?.score ?? 0;
        const smileR = shapes.find((c) => c.categoryName === "mouthSmileRight")?.score ?? 0;
        this.smileVals.push((smileL + smileR) / 2);
      }

      // ── 3. POSTURE & MACRO HAND KINEMATICS VIA POSE (Task 2B-HS) ──
      const pl = this.lastPoseLandmarks;
      let sShoulder = 0.25; // default fallback
      let isCrossed = false;
      let isHandsBelowHip = false;
      let isOpenSpread = false;

      if (pl && pl[11] && pl[12] && pl[0]) {
        this.poseSeen += 1;
        const l = pl[11],
          r = pl[12],
          nose = pl[0];
        sShoulder = Math.hypot(l.x - r.x, l.y - r.y) || 0.25;

        const tiltDeg = Math.abs(
          (Math.atan2(Math.abs(l.y - r.y), Math.abs(l.x - r.x) || 1e-5) * 180) / Math.PI
        );
        const headOff = Math.abs(nose.x - (l.x + r.x) / 2) / sShoulder;
        if (tiltDeg <= 12 && headOff <= 0.35) {
          this.postureOk += 1;
          b.postureOk += 1;
        }

        // Koordinat Pergelangan Tangan (Wrist #15 & #16) dan Pinggul (#23 & #24)
        if (pl[15] && pl[16] && pl[23] && pl[24]) {
          const wL = pl[15];
          const wR = pl[16];
          const leftVisible = (wL.visibility ?? 0.8) > 0.35;
          const rightVisible = (wR.visibility ?? 0.8) > 0.35;

          const dCrossL = Math.hypot(wL.x - r.x, wL.y - r.y) / sShoulder;
          const dCrossR = Math.hypot(wR.x - l.x, wR.y - l.y) / sShoulder;
          isCrossed = leftVisible && rightVisible && dCrossL < 0.4 && dCrossR < 0.4;

          const hipY = (pl[23].y + pl[24].y) / 2;
          isHandsBelowHip =
            (leftVisible && wL.y > hipY) || (rightVisible && wR.y > hipY);

          const wristDist = Math.hypot(wL.x - wR.x, wL.y - wR.y);
          isOpenSpread = leftVisible && rightVisible && wristDist / sShoulder >= 0.35;

          // Hitung Titik Pusat Tangan Aktif (Macro Hand Presence)
          let currHandPos: { x: number; y: number } | null = null;
          if (leftVisible && rightVisible) {
            currHandPos = { x: (wL.x + wR.x) / 2, y: (wL.y + wR.y) / 2 };
          } else if (leftVisible) {
            currHandPos = { x: wL.x, y: wL.y };
          } else if (rightVisible) {
            currHandPos = { x: wR.x, y: wR.y };
          }

          // Hitung Kecepatan vt & Buffer Trajektori
          if (currHandPos) {
            let vt = 0;
            if (this.prevHandPos) {
              const dPos = Math.hypot(
                currHandPos.x - this.prevHandPos.x,
                currHandPos.y - this.prevHandPos.y
              );
              vt = dPos / sShoulder;
            }
            this.prevHandPos = currHandPos;

            this.handRingBuffer.push({ vt, pos: currHandPos });
            if (this.handRingBuffer.length > 15) {
              this.handRingBuffer.shift();
            }

            // Hitung Kecepatan Rata-rata vAvg & Rasio Keterarahan rDirect
            const vAvg =
              this.handRingBuffer.reduce((acc, it) => acc + it.vt, 0) /
              Math.max(1, this.handRingBuffer.length);
            const pFirst = this.handRingBuffer[0].pos;
            const pLast = this.handRingBuffer[this.handRingBuffer.length - 1].pos;
            const dNet = Math.hypot(pLast.x - pFirst.x, pLast.y - pFirst.y);

            let dPath = 0;
            for (let k = 1; k < this.handRingBuffer.length; k++) {
              dPath += Math.hypot(
                this.handRingBuffer[k].pos.x - this.handRingBuffer[k - 1].pos.x,
                this.handRingBuffer[k].pos.y - this.handRingBuffer[k - 1].pos.y
              );
            }
            const rDirect = dNet / (dPath + 1e-6);

            // Klasifikasi Gestur Makro Sederhana (Task 2B-HS)
            if (isCrossed) {
              this.currentHandState = "crossed";
            } else if (isHandsBelowHip) {
              this.currentHandState = "below_hip";
            } else if (vAvg >= 0.008 && vAvg <= 0.065 && (rDirect >= 0.5 || isOpenSpread)) {
              this.currentHandState = "natural"; // Sering & Terarah
              b.gestureActive += 1;
            } else if (vAvg > 0.07 || rDirect < 0.3) {
              this.currentHandState = "flailing"; // Terlalu cepat/acak
            } else {
              this.currentHandState = "static"; // Pasif / santai
            }
          } else {
            if (isCrossed) this.currentHandState = "crossed";
            else if (isHandsBelowHip) this.currentHandState = "below_hip";
            else this.currentHandState = "static";
          }

          this.handCounts[this.currentHandState] += 1;
          b.handCounts[this.currentHandState] += 1;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // ── 4. HUD CANVAS OVERLAY RENDERING (Task 2B-HS: Clean Macro Hand & Pose HUD) ──
  private drawOverlay() {
    const canvas = this.overlayCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== this.video.videoWidth || canvas.height !== this.video.videoHeight) {
      if (this.video.videoWidth > 0 && this.video.videoHeight > 0) {
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!this.skeletonEnabled) return;

    const w = canvas.width;
    const h = canvas.height;

    // A. Gambar Kerangka Tubuh (Pose Skeleton)
    const pl = this.lastPoseLandmarks;
    if (pl) {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(6, 182, 212, 0.75)"; // Cyan cyber
      ctx.fillStyle = "#38bdf8";

      const connections = [
        [11, 12], // Bahu
        [11, 13],
        [13, 15], // Lengan Kiri
        [12, 14],
        [14, 16], // Lengan Kanan
        [11, 23],
        [12, 24],
        [23, 24], // Batang Tubuh
      ];

      for (const [p1, p2] of connections) {
        if (pl[p1] && pl[p2] && (pl[p1].visibility ?? 0.8) > 0.35) {
          ctx.beginPath();
          ctx.moveTo(pl[p1].x * w, pl[p1].y * h);
          ctx.lineTo(pl[p2].x * w, pl[p2].y * h);
          ctx.stroke();
        }
      }

      // Titik Sendi Tubuh
      const joints = [11, 12, 13, 14, 23, 24];
      for (const j of joints) {
        if (pl[j]) {
          ctx.beginPath();
          ctx.arc(pl[j].x * w, pl[j].y * h, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // B. Gambar Indikator Tangan Makro Sederhana (Task 2B-HS)
      // Lingkaran aksen dan cincin radar di pergelangan tangan #15 dan #16
      const handJoints = [15, 16];
      for (const hj of handJoints) {
        const pt = pl[hj];
        if (pt && (pt.visibility ?? 0.8) > 0.35) {
          const hx = pt.x * w;
          const hy = pt.y * h;

          let handColor = "rgba(52, 211, 153, 0.85)"; // Hijau emerald (Natural)
          if (this.currentHandState === "crossed" || this.currentHandState === "flailing") {
            handColor = "rgba(244, 63, 94, 0.85)";
          } else if (this.currentHandState === "below_hip") {
            handColor = "rgba(251, 191, 36, 0.85)";
          }

          ctx.strokeStyle = handColor;
          ctx.lineWidth = 2.0;

          // Cincin Gestur Tangan
          ctx.beginPath();
          ctx.arc(hx, hy, 12, 0, 2 * Math.PI);
          ctx.stroke();

          // Titik Pusat
          ctx.fillStyle = handColor;
          ctx.beginPath();
          ctx.arc(hx, hy, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }

    // C. Gambar Retikel Mata Siber (Iris Crosshair Reticle)
    const fl = this.lastFaceLandmarks;
    if (fl && fl[468] && fl[473]) {
      const irisPoints = [fl[468], fl[473]];

      let reticleColor = "#00f0ff"; // Netral
      if (this.currentGazeState === "focus") reticleColor = "#00ff96";
      else if (this.currentGazeState === "audience") reticleColor = "#38bdf8";
      else if (this.currentGazeState === "unfocused") reticleColor = "#ef4444";
      else if (this.currentGazeState === "reading") reticleColor = "#c084fc";

      for (const pt of irisPoints) {
        const ix = pt.x * w;
        const iy = pt.y * h;

        ctx.strokeStyle = reticleColor;
        ctx.lineWidth = 1.8;

        // Cincin Luar
        ctx.beginPath();
        ctx.arc(ix, iy, 11, 0, 2 * Math.PI);
        ctx.stroke();

        // Crosshair 4-Sumbu
        ctx.beginPath();
        ctx.moveTo(ix - 15, iy);
        ctx.lineTo(ix - 5, iy);
        ctx.moveTo(ix + 5, iy);
        ctx.lineTo(ix + 15, iy);
        ctx.moveTo(ix, iy - 15);
        ctx.lineTo(ix, iy - 5);
        ctx.moveTo(ix, iy + 5);
        ctx.lineTo(ix, iy + 15);
        ctx.stroke();

        // Titik Pupil Inti
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ix, iy, 2, 0, 2 * Math.PI);
        ctx.fill();

        // Saccade Pulse
        if (this.isShiftingNow) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
          ctx.beginPath();
          ctx.arc(ix, iy, 18, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }
    }

    // D. Lencana Status Klasifikasi HUD
    ctx.save();
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.fillRect(10, 10, 180, 48);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.strokeRect(10, 10, 180, 48);

    ctx.fillStyle = "#94a3b8";
    ctx.fillText("MATA:", 18, 28);
    ctx.fillStyle =
      this.currentGazeState === "focus"
        ? "#4ade80"
        : this.currentGazeState === "audience"
        ? "#38bdf8"
        : this.currentGazeState === "unfocused"
        ? "#f87171"
        : this.currentGazeState === "reading"
        ? "#c084fc"
        : "#38bdf8";
    ctx.fillText(this.currentGazeState.toUpperCase(), 65, 28);

    ctx.fillStyle = "#94a3b8";
    ctx.fillText("TANGAN:", 18, 46);
    ctx.fillStyle =
      this.currentHandState === "natural"
        ? "#4ade80"
        : this.currentHandState === "flailing" || this.currentHandState === "crossed"
        ? "#f87171"
        : "#cbd5e1";
    ctx.fillText(this.currentHandState.toUpperCase(), 75, 46);
    ctx.restore();
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function stddev(vals: number[]) {
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
}
