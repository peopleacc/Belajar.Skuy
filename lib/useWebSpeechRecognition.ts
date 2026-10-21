"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type SpeechState = "idle" | "listening" | "unsupported" | "denied" | "error";

export interface UseWebSpeechOptions {
  language?: "id" | "en";
  continuous?: boolean;
  onInterimText?: (interim: string) => void;
  onFinalText?: (final: string) => void;
}

export function useWebSpeechRecognition({
  language = "id",
  continuous = true,
  onInterimText,
  onFinalText,
}: UseWebSpeechOptions = {}) {
  const [state, setState] = useState<SpeechState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  const langCode = language === "en" ? "en-US" : "id-ID";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setState("unsupported");
    }
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setState("unsupported");
      return;
    }

    try {
      // Hentikan instance sebelumnya jika ada
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }

      const rec = new SpeechRec();
      rec.continuous = continuous;
      rec.interimResults = true;
      rec.lang = langCode;

      rec.onstart = () => {
        isListeningRef.current = true;
        setState("listening");
        setErrorMessage(null);
      };

      rec.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcript = item?.[0]?.transcript ?? "";
          if (item.isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        if (final && onFinalText) onFinalText(final);
        if (onInterimText) onInterimText(interim);
      };

      rec.onerror = (e: any) => {
        if (e.error === "not-allowed") {
          setState("denied");
          setErrorMessage("Izin mikrofon ditolak peramban.");
        } else if (e.error === "no-speech") {
          // Tidak ada suara terdeteksi beberapa saat — bukan error fatal
        } else if (e.error !== "aborted") {
          setErrorMessage(`Kendala suara: ${e.error}`);
        }
      };

      rec.onend = () => {
        // Auto-reconnect jika pengguna masih dalam mode mendengarkan (mengatasi timeout hening peramban)
        if (isListeningRef.current && continuous) {
          try {
            rec.start();
          } catch {
            /* ignore restart collision */
          }
        } else {
          isListeningRef.current = false;
          setState("idle");
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (err: any) {
      setState("error");
      setErrorMessage(err?.message ?? "Gagal mengaktifkan pengenalan suara.");
    }
  }, [continuous, langCode, onFinalText, onInterimText]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setState("idle");
  }, []);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return {
    state,
    isListening: state === "listening",
    errorMessage,
    startListening,
    stopListening,
    isSupported: state !== "unsupported",
  };
}
