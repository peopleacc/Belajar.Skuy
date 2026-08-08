"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const MAX_SECONDS = 120; // Fitur R — batas 2 menit/soal (file kecil, transkripsi cepat)

type RecState = "idle" | "recording" | "transcribing" | "unsupported" | "denied";

/**
 * Fitur R — jawab soal esai dengan rekam suara. Transkrip ditaruh ke `value` (via `onChange`)
 * dan BISA DIEDIT sebelum submit (STT tidak sempurna). Rekaman audio TIDAK PERNAH disimpan —
 * begitu transkrip balik dari server, blob-nya dibuang.
 *
 * Fallback WAJIB: browser tak dukung MediaRecorder / bukan secure context / izin mikrofon
 * ditolak → turun jadi textarea polos, supaya soal tetap bisa dijawab (tidak pernah buntu).
 */
export default function VoiceAnswer({
  value,
  onChange,
  disabled,
  locked = false,
}: {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
  /**
   * Fitur CD — paket user belum mencakup latihan suara. Ini SEMATA tampilan;
   * penolakan sesungguhnya ada di Express (`assertFeature`), karena endpoint
   * transkripsi bisa dipanggil langsung tanpa lewat tombol ini.
   */
  locked?: boolean;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      typeof window.MediaRecorder !== "undefined" &&
      typeof navigator?.mediaDevices?.getUserMedia === "function" &&
      window.isSecureContext;
    if (!supported) setState("unsupported");
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        void uploadRecording(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            stopRecording();
            return MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setState("denied");
    }
  }

  function stopRecording() {
    stopTimer();
    mediaRecorderRef.current?.stop();
  }

  async function uploadRecording(blob: Blob) {
    setState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "rekaman.webm");
      const res = await fetch("/api/quiz/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Transkripsi gagal. Coba rekam ulang atau ketik jawabanmu.");
        setState("idle");
        return;
      }
      onChange(data.text ?? "");
      setState("idle");
    } catch {
      setError("Tidak bisa terhubung ke server. Coba rekam ulang atau ketik jawabanmu.");
      setState("idle");
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  // Fitur CD — paket belum mencakup latihan suara. Tombolnya dikunci, TAPI soal
  // tetap bisa dijawab lewat teks: mengunci fitur tambahan tidak boleh membuat
  // user gagal mengerjakan kuisnya sama sekali.
  if (locked) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <i className="bi bi-lock-fill"></i>
            Jawab dengan suara tersedia di paket berbayar
          </span>
          <Link
            href="/pricing"
            className="shrink-0 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600"
          >
            Lihat paket
          </Link>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          disabled={disabled}
          placeholder="Tulis jawabanmu di sini..."
          className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
        />
      </div>
    );
  }

  // Fallback total: browser tak dukung / izin ditolak → textarea polos, soal tetap bisa dijawab
  if (state === "unsupported" || state === "denied") {
    return (
      <div>
        <p className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          {state === "denied"
            ? "🎙️ Izin mikrofon ditolak — tidak apa-apa, ketik saja jawabanmu."
            : "🎙️ Rekam suara tidak didukung di browser ini — ketik saja jawabanmu."}
        </p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          disabled={disabled}
          placeholder="Tulis jawabanmu di sini..."
          className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
        />
      </div>
    );
  }

  return (
    <div>
      {state === "recording" ? (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-rose-600">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
            Merekam… {mm}:{ss}
          </span>
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600"
          >
            ⏹ Selesai
          </button>
        </div>
      ) : state === "transcribing" ? (
        <div className="flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
          <span className="h-2.5 w-2.5 animate-ping rounded-full bg-brand-500" />
          Mentranskrip rekaman…
        </div>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-4 py-4 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-50"
        >
          🎙️ {value ? "Rekam Ulang" : "Mulai Rekam"}
        </button>
      )}

      {value && state === "idle" && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold text-slate-400">
            Transkrip (bisa diedit sebelum submit):
          </p>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            disabled={disabled}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
          />
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-slate-400">
        🔒 Rekamanmu tidak disimpan — hanya teks hasil transkripsinya.
      </p>

      {error && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
      )}
    </div>
  );
}
