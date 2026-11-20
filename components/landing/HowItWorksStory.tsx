"use client";

import { useState } from "react";
import Image from "next/image";
import WalkthroughModal from "@/components/landing/WalkthroughModal";
import type { Dict, Lang } from "@/lib/i18n";

interface HowItWorksStoryProps {
  lang: Lang;
  t: Dict;
}

/**
 * HowItWorksStory - Alur Cara Kerja Terintegrasi (Planning 8 - Task 8B-LP)
 * - Panggung 2-kolom visual story dari Redesign/index.html:
 *   - Kiri: Ilustrasi 3D buku belajar (study-illustration.webp)
 *   - Kanan: 3 Visual step interaktif dengan trigger modal panduan langkah demi langkah.
 * - Disertai detail 5-langkah journey (Planning 7) dengan zigzag flow modern.
 * - Strict Zero Emojis (Aturan F): Menggunakan Bootstrap Icons.
 */
export default function HowItWorksStory({ lang, t }: HowItWorksStoryProps) {
  const isId = lang === "id";
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section id="how" className="scroll-mt-24 px-4 py-24 sm:px-6 md:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Intro */}
        <div className="mb-14 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
              {t.how.eyebrow}
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900">
              {isId ? "Mulainya simpel." : "One small start."}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 text-sm sm:text-base font-bold text-brand-500 hover:text-brand-600"
          >
            <span>{isId ? "Lihat Panduan Lengkap" : "Open Guided Walkthrough"}</span>
            <i className="bi bi-arrow-up-right text-xs"></i>
          </button>
        </div>

        {/* 2-Kolom Story Art + 3 Visual Steps */}
        <div className="grid grid-cols-1 items-center gap-12 rounded-3xl border border-border/80 bg-surface p-8 shadow-card lg:grid-cols-12 lg:p-12 mb-20">
          <div className="relative flex items-center justify-center lg:col-span-5">
            <Image
              src="/images/study-illustration.webp"
              alt="Ilustrasi alur belajar"
              width={1456}
              height={1088}
              className="h-auto max-h-[300px] w-auto object-contain drop-shadow-xl"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 lg:col-span-7">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="group flex flex-col text-left rounded-2xl border border-border/60 bg-surface-2/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand-500 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-xl text-brand-500 transition group-hover:bg-brand-500 group-hover:text-white">
                <i className="bi bi-journal-bookmark-fill"></i>
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                {isId ? "1. Pilih Topik" : "1. Pick a Topic"}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
                {isId ? "Ikuti rasa penasaranmu atau materi ujian." : "Follow your curiosity or study focus."}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="group flex flex-col text-left rounded-2xl border border-border/60 bg-surface-2/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand-500 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-xl text-brand-500 transition group-hover:bg-brand-500 group-hover:text-white">
                <i className="bi bi-check2-circle"></i>
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                {isId ? "2. Pahami Materi" : "2. Make It Click"}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
                {isId ? "Baca materi, uji kuis cerdas, dan pahami intinya." : "Read lessons, test quizzes, and grasp key concepts."}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="group flex flex-col text-left rounded-2xl border border-border/60 bg-surface-2/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand-500 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-xl text-brand-500 transition group-hover:bg-brand-500 group-hover:text-white">
                <i className="bi bi-mic-fill"></i>
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                {isId ? "3. Coba Latihan" : "3. Give It a Voice"}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
                {isId ? "Sampaikan gagasanmu lewat simulasi suara dan kamera." : "Present your ideas with live voice & camera feedback."}
              </p>
            </button>
          </div>
        </div>

        {/* 5-Step Detailed Zigzag Journey (Planning 7) */}
        <div className="space-y-16">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
              {isId ? "Alur Kerja End-to-End" : "End-to-End Workflow"}
            </span>
            <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
              {t.how.title}
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm sm:text-base text-slate-500">
              {t.how.subtitle}
            </p>
          </div>

          <div className="space-y-16">
            {t.how.steps.map((s, i) => (
              <div
                key={s.title}
                className={`flex flex-col items-center gap-8 lg:gap-16 ${
                  i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"
                }`}
              >
                <div className="flex-1 space-y-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-500/20 bg-brand-500/10 text-lg font-extrabold text-brand-600 shadow-sm">
                    {i + 1}
                  </span>
                  <h4 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    {s.title}
                  </h4>
                  <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                    {s.desc}
                  </p>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-brand-200/60 bg-brand-50/80 px-3 py-1.5 text-xs font-semibold text-brand-700">
                    <i className={`bi ${s.icon}`}></i>
                    <span>{s.note}</span>
                  </div>
                </div>

                <div className="w-full flex-1">
                  <div className="group relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-3xl border border-border/80 bg-white p-8 shadow-card transition-all duration-300 hover:shadow-xl">
                    <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl transition-all duration-500 group-hover:scale-150"></div>
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-500/10 text-3xl text-brand-500 shadow-sm transition-transform duration-300 group-hover:scale-110">
                      <i className={`bi ${s.icon}`}></i>
                    </div>
                    <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-slate-600">
                      <i className="bi bi-stars text-xs text-brand-500"></i>
                      <span>AI Step {i + 1}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <WalkthroughModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        lang={lang}
      />
    </section>
  );
}

