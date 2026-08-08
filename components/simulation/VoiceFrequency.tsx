"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fitur DC — visualisasi level mikrofon real-time. Data ASLI dari Web Audio API
 * (AnalyserNode) yang sudah tersedia di semua browser modern, TANPA paket baru —
 * pola client-side yang sama dengan `VisualAnalyzer` (lib/visualAnalysis.ts).
 *
 * Cuma MEMBACA stream utk digambar ulang tiap frame lalu dibuang — tidak merekam,
 * tidak menyimpan, tidak pernah menyentuh server.
 */

const BAR_COUNT = 20;

function useMicLevels(stream: MediaStream | null) {
  const [bars, setBars] = useState<number[]>(() => new Array(BAR_COUNT).fill(0));
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setBars(new Array(BAR_COUNT).fill(0));
      setVolume(0);
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    // Sengaja TIDAK disambung ke ctx.destination — cuma dibaca, bukan diputar ulang
    // (menyambung ke destination akan bikin mic-nya kedengaran/feedback ke speaker).
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    function tick() {
      analyser.getByteFrequencyData(data);
      const bucketSize = Math.floor(data.length / BAR_COUNT) || 1;
      const next: number[] = [];
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < bucketSize; j++) sum += data[i * bucketSize + j] ?? 0;
        next.push(sum / bucketSize / 255);
      }
      setBars(next);
      setVolume(Math.round((data.reduce((a, b) => a + b, 0) / data.length / 255) * 100));
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      analyser.disconnect();
      void ctx.close().catch(() => {});
    };
  }, [stream]);

  return { bars, volume };
}

function Bars({ bars, className }: { bars: number[]; className: string }) {
  return (
    <div className={`flex items-end gap-[3px] ${className}`}>
      {bars.map((v, i) => (
        <span
          key={i}
          className="w-1 flex-1 rounded-full bg-brand-500 transition-all duration-75"
          style={{ height: `${Math.max(8, v * 100)}%`, opacity: 0.4 + v * 0.6 }}
        />
      ))}
    </div>
  );
}

/**
 * `variant="card"` — panel berlabel + persentase volume (dipakai di presentasi).
 * `variant="inline"` — cuma batang, tanpa label (dipakai di sebelah kartu pertanyaan).
 */
export function VoiceFrequency({
  stream,
  variant = "card",
}: {
  stream: MediaStream | null;
  variant?: "card" | "inline";
}) {
  const { bars, volume } = useMicLevels(stream);
  const prevStreamRef = useRef(stream);
  prevStreamRef.current = stream;

  if (variant === "inline") {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
        <span className="text-xs text-slate-400">🎙️</span>
        <Bars bars={bars} className="h-6 flex-1" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <p className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Voice Frequency
        <span className="text-xs normal-case">🎙️</span>
      </p>
      <Bars bars={bars} className="mt-3 h-16" />
      <p className="mt-2 text-xs text-slate-400">Input Volume {volume}%</p>
    </div>
  );
}
