/**
 * speechCadence.ts — Realtime Words Per Second (WPS) & WPM Cadence Tracker
 *
 * Mengukur kecepatan bicara (kata/detik dan WPM) secara streaming di browser
 * menggunakan Web Speech API (atau fallback transcript timing).
 *
 * Rubrik Klasifikasi Kecepatan Bicara (planning-update-19.md):
 * - Normal (Ideal): 1.8 - 2.5 WPS (110 - 150 WPM) -> Skor 80 - 100 (Warna Hijau)
 * - Agak Kecepatan: 2.5 - 2.9 WPS (150 - 175 WPM) -> Skor 70 - 80 (Warna Amber)
 * - Agak Lambat: 1.4 - 1.8 WPS (85 - 110 WPM) -> Skor 60 - 70 (Warna Sky Blue)
 * - Kecepatan (Terlalu Cepat): > 2.9 WPS (> 175 WPM) atau < 1.3 WPS (< 80 WPM) -> Skor 50 - 60 (Warna Rose)
 */

export type CadenceCategory = "ideal" | "fast" | "slow" | "rush" | "silent";

export type CadenceSnapshot = {
  liveWps: number;
  liveWpm: number;
  category: CadenceCategory;
  label: string;
  coachingTip: string;
  colorClass: string;
  totalWords: number;
  speechDurationSec: number;
};

export type CadenceTimelinePoint = {
  t: number;
  wps: number;
  wpm: number;
  category: CadenceCategory;
};

export type SegmentCadenceSummary = {
  avgWps: number;
  avgWpm: number;
  totalWords: number;
  durationSec: number;
  speedScore: number;
  category: CadenceCategory;
  timeline: CadenceTimelinePoint[];
};

export class SpeechCadenceTracker {
  private wordsQueue: { t: number; word: string }[] = [];
  private totalWords = 0;
  private startTime = 0;
  private recognition: any = null;
  private isRunning = false;
  private language = "id-ID";
  private timeline: CadenceTimelinePoint[] = [];
  private sampleTimer: ReturnType<typeof setInterval> | null = null;
  private onUpdateCallback?: (snapshot: CadenceSnapshot) => void;

  constructor(language: "id" | "en" = "id") {
    this.language = language === "en" ? "en-US" : "id-ID";
  }

  setCallback(cb: (snapshot: CadenceSnapshot) => void) {
    this.onUpdateCallback = cb;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.resetSegment();

    // Inisialisasi Web Speech API jika tersedia di peramban
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = this.language;

          rec.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                this.feedText(transcript);
              }
            }
          };

          rec.onerror = (e: any) => {
            // Error suara tidak fatal; jangan hentikan sesi
            if (e.error !== "no-speech" && e.error !== "aborted") {
              // silent recovery
            }
          };

          rec.onend = () => {
            if (this.isRunning) {
              try {
                rec.start();
              } catch {
                /* ignore already started */
              }
            }
          };

          rec.start();
          this.recognition = rec;
        } catch {
          this.recognition = null;
        }
      }
    }

    // Interval sampling kalkulasi per 250ms untuk UI responsif
    this.sampleTimer = setInterval(() => {
      const snap = this.getSnapshot();
      if (this.onUpdateCallback) {
        this.onUpdateCallback(snap);
      }
      // Catat timeline per 1 detik
      const elapsedSec = Math.floor((performance.now() - this.startTime) / 1000);
      if (
        elapsedSec > 0 &&
        (!this.timeline.length || this.timeline[this.timeline.length - 1].t !== elapsedSec)
      ) {
        this.timeline.push({
          t: elapsedSec,
          wps: snap.liveWps,
          wpm: snap.liveWpm,
          category: snap.category,
        });
      }
    }, 250);
  }

  resetSegment() {
    this.wordsQueue = [];
    this.totalWords = 0;
    this.startTime = performance.now();
    this.timeline = [];
  }

  feedText(text: string) {
    const tokens = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const now = performance.now();
    for (const w of tokens) {
      this.wordsQueue.push({ t: now, word: w });
      this.totalWords += 1;
    }
  }

  getSnapshot(): CadenceSnapshot {
    const now = performance.now();
    const windowMs = 3000; // Sliding window 3 detik
    // Bersihkan kata di luar 5 detik
    this.wordsQueue = this.wordsQueue.filter((item) => now - item.t <= 5000);

    const recentWords = this.wordsQueue.filter((item) => now - item.t <= windowMs);
    const windowSec = windowMs / 1000;
    const liveWps = Math.round((recentWords.length / windowSec) * 10) / 10;
    const liveWpm = Math.round(liveWps * 60);

    const speechDurationSec = Math.max(1, Math.round((now - this.startTime) / 1000));

    let category: CadenceCategory = "silent";
    let label = "Menunggu Suara";
    let coachingTip = "Mulai berbicara untuk memantau ritme dan laju kata.";
    let colorClass = "text-slate-500 bg-slate-100 border-slate-200";

    if (recentWords.length > 0) {
      if (liveWps >= 1.8 && liveWps <= 2.5) {
        category = "ideal";
        label = "Ideal & Nyaman";
        coachingTip = "Laju bicara sangat pas! Pertahankan artikulasi dan tempo ini.";
        colorClass = "text-emerald-700 bg-emerald-50 border-emerald-300";
      } else if (liveWps > 2.5 && liveWps <= 2.9) {
        category = "fast";
        label = "Agak Kecepatan";
        coachingTip = "Tempo sedikit cepat. Beri jeda 1 detik di akhir kalimat penting.";
        colorClass = "text-amber-700 bg-amber-50 border-amber-300";
      } else if (liveWps >= 1.3 && liveWps < 1.8) {
        category = "slow";
        label = "Agak Lambat";
        coachingTip = "Tempo agak santai. Sedikit percepat untuk menjaga antusiasme audiens.";
        colorClass = "text-sky-700 bg-sky-50 border-sky-300";
      } else if (liveWps > 2.9) {
        category = "rush";
        label = "Terlalu Cepat";
        coachingTip = "Terburu-buru! Tarik napas sejenak agar poin Anda mudah dicerna.";
        colorClass = "text-rose-700 bg-rose-50 border-rose-300";
      } else {
        category = "slow";
        label = "Tersendat";
        coachingTip = "Ritme sangat lambat. Lanjutkan poin berikutnya.";
        colorClass = "text-indigo-700 bg-indigo-50 border-indigo-300";
      }
    }

    return {
      liveWps,
      liveWpm,
      category,
      label,
      coachingTip,
      colorClass,
      totalWords: this.totalWords,
      speechDurationSec,
    };
  }

  collectSlideCadence(): SegmentCadenceSummary {
    const now = performance.now();
    const durationSec = Math.max(1, (now - this.startTime) / 1000);
    const avgWps = Math.round((this.totalWords / durationSec) * 10) / 10;
    const avgWpm = Math.round(avgWps * 60);

    // Hitung Skor Kecepatan (30%) sesuai tabel rubrik:
    // Normal (Ideal: 80 - 100), Agak Kecepatan: 70 - 80, Agak Lambat: 60 - 70, Terlalu Cepat: 50 - 60
    let speedScore = 75;
    let category: CadenceCategory = "ideal";

    if (avgWpm >= 110 && avgWpm <= 150) {
      speedScore = 90;
      category = "ideal";
    } else if (avgWpm > 150 && avgWpm <= 175) {
      speedScore = 75;
      category = "fast";
    } else if (avgWpm >= 85 && avgWpm < 110) {
      speedScore = 68;
      category = "slow";
    } else {
      speedScore = 55;
      category = "rush";
    }

    const summary: SegmentCadenceSummary = {
      avgWps,
      avgWpm,
      totalWords: this.totalWords,
      durationSec: Math.round(durationSec),
      speedScore,
      category,
      timeline: [...this.timeline],
    };

    this.resetSegment();
    return summary;
  }

  stop() {
    this.isRunning = false;
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        /* ignore */
      }
      this.recognition = null;
    }
  }
}
