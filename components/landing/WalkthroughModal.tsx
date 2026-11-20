"use client";

import { useState, useEffect } from "react";
import type { Lang } from "@/lib/i18n";

interface WalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
}

const STEPS = [
  {
    title: { id: "Pilih hal yang bikin penasaran", en: "Pick something you are curious about" },
    body: {
      id: "Tentukan satu topik yang ingin kamu pahami atau kuasai hari ini.",
      en: "Choose one topic you want to understand or master today.",
    },
    example: {
      id: "Contoh: Komunikasi efektif untuk presentasi kelas atau konsep dasar kecerdasan buatan.",
      en: "Example: Effective communication for classroom pitching or machine learning basics.",
    },
    icon: "bi-journal-bookmark-fill",
  },
  {
    title: { id: "Ubah topik jadi pemahaman mendalam", en: "Turn your topic into understanding" },
    body: {
      id: "Baca materi terstruktur dari AI. Coba kuis interaktif. Pahami alasan di balik setiap jawaban.",
      en: "Read structured AI lessons. Try smart quizzes. Understand the rationale behind every answer.",
    },
    example: {
      id: "Prinsip utama: sesuaikan pesan dengan tingkat pengetahuan audiens dan dukung dengan contoh nyata.",
      en: "Key principle: match your message to audience knowledge and back it with relatable examples.",
    },
    icon: "bi-check2-circle",
  },
  {
    title: { id: "Sekarang, coba sampaikan dengan suaramu", en: "Now, give it your own voice" },
    body: {
      id: "Pilih simulasi presentasi atau wawancara. Coba latihan 1 menit dengan panduan rubrik real-time.",
      en: "Select presentation or interview simulation. Practice speaking for 1 minute with real-time HUD.",
    },
    example: {
      id: "Tantangan awal: jelaskan satu gagasan utama dalam durasi satu menit tanpa teks hafalan.",
      en: "First challenge: explain one key idea within sixty seconds without reading verbatim.",
    },
    icon: "bi-mic-fill",
  },
];

/**
 * WalkthroughModal - Modal Panduan Alur Belajar 3-Langkah (Planning 8 - Task 8B-LP)
 * Mengadopsi dialog panduan langkah interaktif dari Redesign/index.html.
 */
export default function WalkthroughModal({ isOpen, onClose, lang }: WalkthroughModalProps) {
  const isId = lang === "id";
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const step = STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onClose();
      const el = document.getElementById("features");
      el?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl border border-border/80 bg-white p-6 sm:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-border/70 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <i className="bi bi-compass-fill"></i>
            </span>
            <h2 id="guide-title" className="text-xl font-bold text-slate-900">
              {isId ? "Alur Belajarmu" : "Your Learning Journey"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-slate-500 transition hover:bg-surface-2 hover:text-slate-900"
          >
            <i className="bi bi-x-lg text-sm"></i>
          </button>
        </div>

        {/* Stepper Tabs */}
        <div className="mt-6 flex gap-2" role="tablist">
          {STEPS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentStep(i)}
              className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition ${
                currentStep === i
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-surface-2 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{isId ? `Langkah ${i + 1}` : `Step ${i + 1}`}</span>
            </button>
          ))}
        </div>

        {/* Isi Langkah Aktif */}
        <div className="mt-6 space-y-4 rounded-2xl border border-border/60 bg-surface-2/60 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white">
              <i className={`bi ${step.icon} text-lg`}></i>
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              {step.title[lang]}
            </h3>
          </div>

          <p className="text-sm leading-relaxed text-slate-600">
            {step.body[lang]}
          </p>

          <div className="rounded-xl border border-border/80 bg-white p-4 text-xs sm:text-sm text-slate-700">
            <strong className="block mb-1 text-slate-500 text-xs uppercase tracking-wider">
              {isId ? "Contoh Praktik:" : "Example In Practice:"}
            </strong>
            <span>{step.example[lang]}</span>
          </div>
        </div>

        {/* Footer Modal Actions */}
        <div className="mt-6 flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500">
            {isId ? `Langkah ${currentStep + 1} dari ${STEPS.length}` : `Step ${currentStep + 1} of ${STEPS.length}`}
          </span>

          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="rounded-xl border border-border px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 transition hover:bg-surface-2"
              >
                {isId ? "Kembali" : "Back"}
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-brand-600"
            >
              <span>{currentStep === STEPS.length - 1 ? (isId ? "Coba Sekarang" : "Try Now") : (isId ? "Lanjutkan" : "Continue")}</span>
              <i className="bi bi-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

