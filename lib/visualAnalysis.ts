// Fitur BC (planning-update-newfitur) — analisis visual DI BROWSER.
//
// MediaPipe (pretrained) memberi KOORDINAT landmark; metrik di bawah murni rumus
// geometri atas koordinat itu — TANPA model/training/dataset sendiri (keputusan
// planning). Tidak satu pun frame meninggalkan browser: keluaran modul ini hanya
// angka agregat per slide + timeline bucket 10 detik.
//
// Aset (wasm + model .task) di-self-host dari /public/mediapipe — versi terkunci
// dengan paket npm, tanpa CDN saat runtime.

export type VisualSlideMetrics = {
  eyeContactRatio: number | null;
  postureScore: number | null;
  expressionVariety: number | null;
  gestureRate: number | null; // gerakan tangan per menit
  framesSampled: number;
  timeline: { t: number; eye: number | null; posture: number | null; gesture: number | null }[];
};

const WASM_PATH = "/mediapipe/wasm";
const MODELS = {
  face: "/mediapipe/models/face_landmarker.task",
  pose: "/mediapipe/models/pose_landmarker_lite.task",
  hand: "/mediapipe/models/hand_landmarker.task",
};

// Ambang "menghadap kamera" — PERKIRAAN dari arah kepala, bukan arah tatapan
// sungguhan (batas akurasi dinyatakan di planning & UI, jangan diperlakukan pasti).
const YAW_MAX_DEG = 18;
const PITCH_MAX_DEG = 15;
const BUCKET_MS = 10_000;

type Landmarkers = {
  face: import("@mediapipe/tasks-vision").FaceLandmarker;
  pose: import("@mediapipe/tasks-vision").PoseLandmarker;
  hand: import("@mediapipe/tasks-vision").HandLandmarker;
};

type Bucket = { frames: number; eyeOk: number; postureOk: number; gestureActive: number };

// WASM MediaPipe/TFLite (Emscripten) mengeluarkan sebagian log internal lewat
// console.error meski cuma informasi ("INFO: Created TensorFlow Lite XNNPACK
// delegate for CPU."), bukan error sungguhan — dan bisa muncul KAPAN SAJA
// selama siklus hidup modul (load model, inferensi pertama, atau cleanup),
// jadi difilter SEKALI di level modul (bukan dibungkus sempit di satu titik
// panggilan) supaya tertangkap di mana pun ia muncul. Next.js dev mode
// mengubah setiap console.error jadi layar merah penuh, sehingga log yang
// tidak berbahaya ini terlihat seperti bug. Regex sempit — cuma pola pesan
// ini persis; error lain tetap tampil normal.
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
  private intervalMs = 125; // ~8fps awal; adaptif turun di perangkat lemah
  private detectEma = 0;

  // akumulator per slide
  private frames = 0;
  private eyeOk = 0;
  private poseSeen = 0;
  private postureOk = 0;
  private smileVals: number[] = [];
  private gestureEvents = 0;
  private prevWrist: { x: number; y: number } | null = null;
  private wasMoving = false;
  private slideStart = 0;
  private buckets: Bucket[] = [];

  private constructor(video: HTMLVideoElement, lm: Landmarkers) {
    this.video = video;
    this.lm = lm;
  }

  /** Muat wasm + 3 model (sekali, beberapa detik) — panggil saat menyiapkan sesi. */
  static async create(video: HTMLVideoElement): Promise<VisualAnalyzer> {
    suppressBenignWasmLogs();
    const { FilesetResolver, FaceLandmarker, PoseLandmarker, HandLandmarker } = await import(
      "@mediapipe/tasks-vision"
    );
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const common = { runningMode: "VIDEO" as const };
    const [face, pose, hand] = await Promise.all([
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
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODELS.hand },
        ...common,
        numHands: 2,
      }),
    ]);
    return new VisualAnalyzer(video, { face, pose, hand });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startSlide();
    this.loop();
  }

  startSlide() {
    this.frames = 0;
    this.eyeOk = 0;
    this.poseSeen = 0;
    this.postureOk = 0;
    this.smileVals = [];
    this.gestureEvents = 0;
    this.prevWrist = null;
    this.wasMoving = false;
    this.slideStart = performance.now();
    this.buckets = [];
  }

  /** Rangkum metrik slide berjalan lalu reset untuk slide berikutnya. */
  collectSlide(): VisualSlideMetrics {
    const elapsedMin = (performance.now() - this.slideStart) / 60000;
    const metrics: VisualSlideMetrics = {
      eyeContactRatio: this.frames > 0 ? round2(this.eyeOk / this.frames) : null,
      postureScore: this.poseSeen > 0 ? round2(this.postureOk / this.poseSeen) : null,
      expressionVariety:
        this.smileVals.length > 3 ? round2(Math.min(1, stddev(this.smileVals) * 2)) : null,
      gestureRate: elapsedMin > 0.05 ? round2(this.gestureEvents / elapsedMin) : null,
      framesSampled: this.frames,
      timeline: this.buckets.map((b, i) => ({
        t: i * (BUCKET_MS / 1000),
        eye: b.frames > 0 ? round2(b.eyeOk / b.frames) : null,
        posture: b.frames > 0 ? round2(b.postureOk / b.frames) : null,
        gesture: b.frames > 0 ? round2(b.gestureActive / b.frames) : null,
      })),
    };
    this.startSlide();
    return metrics;
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.lm.face.close();
    this.lm.pose.close();
    this.lm.hand.close();
  }

  private loop() {
    if (!this.running) return;
    const t0 = performance.now();
    try {
      this.sample(t0);
    } catch {
      /* satu frame gagal → lewati, jangan hentikan sesi */
    }
    const cost = performance.now() - t0;
    // Adaptif utk perangkat lemah (DoD BC): EMA biaya deteksi menentukan interval.
    this.detectEma = this.detectEma === 0 ? cost : this.detectEma * 0.8 + cost * 0.2;
    this.intervalMs = this.detectEma > 180 ? 500 : this.detectEma > 90 ? 250 : 125;
    this.timer = setTimeout(() => this.loop(), this.intervalMs);
  }

  private bucket(): Bucket {
    const i = Math.min(119, Math.floor((performance.now() - this.slideStart) / BUCKET_MS));
    while (this.buckets.length <= i) {
      this.buckets.push({ frames: 0, eyeOk: 0, postureOk: 0, gestureActive: 0 });
    }
    return this.buckets[i];
  }

  private sample(ts: number) {
    if (this.video.readyState < 2) return;
    const b = this.bucket();
    this.frames += 1;
    b.frames += 1;

    // --- wajah: arah kepala (proxy kontak mata) + senyum (variasi ekspresi) ---
    const face = this.lm.face.detectForVideo(this.video, ts);
    const mat = face.facialTransformationMatrixes?.[0]?.data;
    if (mat) {
      // kolom ke-3 matriks rotasi = vektor normal wajah; yaw/pitch dari situ.
      // Konvensi tanda tak penting — ambang memakai |sudut|.
      const fx = mat[8], fy = mat[9], fz = Math.abs(mat[10]) || 1e-6;
      const yaw = Math.abs((Math.atan2(fx, fz) * 180) / Math.PI);
      const pitch = Math.abs((Math.atan2(fy, fz) * 180) / Math.PI);
      if (yaw <= YAW_MAX_DEG && pitch <= PITCH_MAX_DEG) {
        this.eyeOk += 1;
        b.eyeOk += 1;
      }
    }
    const shapes = face.faceBlendshapes?.[0]?.categories;
    if (shapes) {
      const smileL = shapes.find((c) => c.categoryName === "mouthSmileLeft")?.score ?? 0;
      const smileR = shapes.find((c) => c.categoryName === "mouthSmileRight")?.score ?? 0;
      this.smileVals.push((smileL + smileR) / 2);
    }

    // --- postur: kemiringan garis bahu + offset kepala dari tengah bahu ---
    const pose = this.lm.pose.detectForVideo(this.video, ts);
    const pl = pose.landmarks?.[0];
    if (pl && pl[11] && pl[12] && pl[0]) {
      this.poseSeen += 1;
      const l = pl[11], r = pl[12], nose = pl[0];
      const width = Math.abs(l.x - r.x) || 1e-6;
      const tiltDeg = Math.abs((Math.atan2(Math.abs(l.y - r.y), width) * 180) / Math.PI);
      const headOff = Math.abs(nose.x - (l.x + r.x) / 2) / width;
      if (tiltDeg <= 12 && headOff <= 0.35) {
        this.postureOk += 1;
        b.postureOk += 1;
      }
    }

    // --- tangan: transisi diam→bergerak dihitung sebagai satu gestur ---
    const hands = this.lm.hand.detectForVideo(this.video, ts);
    const wrist = hands.landmarks?.[0]?.[0];
    if (wrist) {
      const moving = this.prevWrist
        ? Math.hypot(wrist.x - this.prevWrist.x, wrist.y - this.prevWrist.y) > 0.025
        : false;
      if (moving) b.gestureActive += 1;
      if (moving && !this.wasMoving) this.gestureEvents += 1;
      this.wasMoving = moving;
      this.prevWrist = { x: wrist.x, y: wrist.y };
    } else {
      this.prevWrist = null;
      this.wasMoving = false;
    }
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function stddev(vals: number[]) {
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
}
