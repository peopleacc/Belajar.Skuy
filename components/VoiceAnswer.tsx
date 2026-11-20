"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const MAX_SECONDS = 120; // 2 menit/soal
const MAX_ATTEMPTS = 3;  // Maksimal 3 kali rekam suara per soal
const MAX_CHARS = 400;   // Batasan panjang karakter esai ringkas

type RecState = "idle" | "recording" | "transcribing" | "unsupported" | "denied";

export default function VoiceAnswer({
  value,
  onChange,
  disabled,
  locked = false,
}: {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
  locked?: boolean;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attemptsUsed);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      typeof window.MediaRecorder !== "undefined" &&
      typeof navigator?.mediaDevices?.getUserMedia === "function" &&
      window.isSecureContext;
    if (!supported) setState("unsupported");
    return () => {
      // Task 15D-QS (F38): Bersihkan timer, recorder, dan hardware mic stream saat unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    if (attemptsLeft <= 0) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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

      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const actualMime = recorder.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: actualMime });
        const ext = actualMime.includes("mp4") ? "mp4" : "webm";
        void uploadRecording(blob, `rekaman.${ext}`);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000); // Minta potongan tiap 1 detik agar buffer audio tidak kosong
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.requestData();
      } catch {
        /* ignore */
      }
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function uploadRecording(blob: Blob, filename = "rekaman.webm") {
    if (!blob || blob.size === 0) {
      setError("Rekaman kosong atau mikrofon tidak menangkap audio. Silakan coba lagi.");
      setState("idle");
      return;
    }
    setState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, filename);
      const res = await fetch("/api/quiz/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Transkripsi gagal. Coba rekam ulang atau ketik jawabanmu.");
        setState("idle");
        return;
      }

      // Ambil teks & potong aman maksimal 400 karakter
      const rawText = (data.text ?? "").trim();
      const cleanText = rawText.slice(0, MAX_CHARS);
      onChange(cleanText);

      setAttemptsUsed((prev) => prev + 1);

      if (rawText.length > MAX_CHARS) {
        setError("Catatan: Hasil transkrip dipotong maksimal 400 karakter agar esai tetap padat.");
      }

      setState("idle");
    } catch {
      setError("Tidak bisa terhubung ke server. Coba rekam ulang atau ketik jawabanmu.");
      setState("idle");
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (locked) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <i className="bi bi-lock-fill"></i>
            Jawab dengan suara tersedia di paket berbayar
          </span>
          <Link href="/pricing" className="text-xs font-bold text-accent hover:underline">
            Lihat paket →
          </Link>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
          maxLength={MAX_CHARS}
          rows={5}
          disabled={disabled}
          placeholder="Ketik jawabanmu di sini (atau upgrade untuk rekam suara)..."
          className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>Maksimal {MAX_CHARS} karakter</span>
          <span className={`font-mono font-bold ${value.length >= MAX_CHARS ? "text-rose-600" : value.length >= 350 ? "text-amber-600" : "text-slate-400"}`}>
            {value.length} / {MAX_CHARS}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {state === "idle" && (
          <>
            {attemptsLeft > 0 ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={disabled}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-brand-500/20 transition hover:bg-brand-600 disabled:opacity-50"
                >
                  <i className="bi bi-mic-fill"></i>
                  {value ? "Rekam Ulang Jawaban" : "Mulai Rekam Jawaban"}
                </button>
                <span
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border ${
                    attemptsLeft === 3
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : attemptsLeft === 2
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {attemptsLeft}x kesempatan rekam tersisa
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-500">
                <i className="bi bi-slash-circle text-slate-400" />
                <span>Batas 3x rekam suara telah tercapai</span>
              </div>
            )}
          </>
        )}

        {state === "recording" && (
          <div className="inline-flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2">
            <span className="flex h-2.5 w-2.5 items-center justify-center">
              <span className="h-2.5 w-2.5 animate-ping rounded-full bg-rose-500" />
            </span>
            <span className="font-mono text-xs font-bold text-rose-600">
              {mm}:{ss}
            </span>
            <span className="text-[11px] text-rose-500">maks 2 menit</span>
            <button
              type="button"
              onClick={stopRecording}
              className="ml-2 rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-600"
            >
              Selesai Rekam
            </button>
          </div>
        )}

        {state === "transcribing" && (
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            Mentranskrip rekaman...
          </div>
        )}

        {state === "denied" && (
          <p className="text-xs text-rose-600">
            Izin mikrofon ditolak. Buka izin mikrofon di browser atau ketik jawabanmu di bawah.
          </p>
        )}
        {state === "unsupported" && (
          <p className="text-xs text-slate-400">
            Browser ini tidak mendukung perekaman audio. Ketik jawabanmu langsung di bawah.
          </p>
        )}
      </div>

      {attemptsLeft === 0 && (
        <p className="text-[11px] text-slate-500 italic">
          Kamu telah menggunakan kuota 3x rekam suara untuk soal ini. Kamu masih bisa mengedit teks jawabanmu secara manual di bawah sebelum mengirimkan kuis.
        </p>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Transkrip Jawaban (Bisa Diedit Manual Sebelum Submit)
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
          maxLength={MAX_CHARS}
          rows={5}
          disabled={disabled || state === "recording" || state === "transcribing"}
          placeholder={
            state === "transcribing"
              ? "Sedang memproses suara..."
              : "Hasil transkrip rekamanmu akan muncul di sini (maks 400 karakter). Kamu bisa mengoreksi kalimatnya sebelum dikirim."
          }
          className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
        />
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Maksimal {MAX_CHARS} karakter</span>
          <span
            className={`font-mono font-bold ${
              value.length >= MAX_CHARS
                ? "text-rose-600"
                : value.length >= 350
                ? "text-amber-600"
                : "text-slate-400"
            }`}
          >
            {value.length} / {MAX_CHARS}
          </span>
        </div>
      </div>
    </div>
  );
}
