"use client";

import Image from "next/image";
import Link from "next/link";
import type { Dict, Lang } from "@/lib/i18n";

interface HeroSpreadProps {
  lang: Lang;
  t: Dict;
}

/**
 * HeroSpread - Hero Section Redesain (Planning 8 - Task 8B-LP)
 * - Mengadopsi tata letak panggung Redesign/index.html:
 *   - Kolom Kiri: Tipografi Inter besar fluid, summary padat, aksi ganda (Mulai gratis & Coba dulu).
 *   - Kolom Kanan: Panggung buku 3D mengambang (study-illustration.webp) dengan kartu ide melayang.
 *   - Baris Bawah: Quick exploration chips (Materi, Kuis, Suara, Presentasi, Wawancara).
 * - Zero Emojis (Aturan F): Memakai Bootstrap Icons.
 */
export default function HeroSpread({ lang, t }: HeroSpreadProps) {
  const isId = lang === "id";

  const headline1 = isId ? "Belajar, skuy." : "Learn, skuy.";
  const headline2 = isId ? "Siap tampil." : "Speak up.";
  const summary = isId
    ? "Materi, kuis, dan latihan AI. Satu ruang."
    : "Lessons, quizzes, and AI practice. Your way.";
  const startBtn = isId ? "Mulai gratis" : "Start for free";
  const tryBtn = isId ? "Coba dulu" : "Try it here";
  const ideaTicket = isId ? "Ide barumu dimulai di sini." : "Your next idea starts here.";
  const pickPrompt = isId ? "Mau eksplorasi apa?" : "Pick your next discovery.";

  return (
    <section className="relative pt-6 pb-12 sm:pt-10 sm:pb-16" id="home" aria-labelledby="hero-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-8 min-h-[520px]">
          {/* Kolom Kiri: Headline & CTA Buttons */}
          <div className="lg:col-span-6 space-y-6">
            <h1
              id="hero-heading"
              className="text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-extrabold tracking-[-0.055em] leading-[1.05] text-slate-900"
            >
              <span>{headline1}</span>
              <br />
              <span className="text-brand-500">{headline2}</span>
            </h1>

            <p className="max-w-md text-base sm:text-lg leading-relaxed text-slate-600">
              {summary}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/register"
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 text-sm sm:text-base font-semibold text-white shadow-lg shadow-brand-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-600 active:translate-y-0"
              >
                <span>{startBtn}</span>
                <i className="bi bi-arrow-up-right text-xs"></i>
              </Link>

              <a
                href="#features"
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-xl border border-border/80 bg-surface px-6 text-sm sm:text-base font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-brand-500"
              >
                <span>{tryBtn}</span>
                <i className="bi bi-arrow-down text-sm"></i>
              </a>
            </div>
          </div>

          {/* Kolom Kanan: 3D Illustration Stage */}
          <div className="relative flex items-center justify-center lg:col-span-6">
            <div className="relative w-full max-w-[560px]">
              {/* Gambar 3D WebP dengan efek book-float lembut */}
              <div className="animate-book-float relative flex items-center justify-center">
                <Image
                  src="/images/study-illustration.webp"
                  alt="Ilustrasi 3D dua mahasiswa belajar di atas buku terbuka"
                  width={1456}
                  height={1088}
                  priority
                  className="h-auto max-h-[460px] w-full object-contain drop-shadow-2xl"
                />
              </div>

              {/* Floating Idea Ticket */}
              <a
                href="#features"
                className="absolute bottom-4 right-2 sm:right-6 inline-flex items-center gap-3 rounded-2xl border border-border/80 bg-white/95 px-4 py-3 text-xs sm:text-sm font-semibold text-slate-800 shadow-xl backdrop-blur-md transition-transform duration-200 hover:-translate-y-1 hover:shadow-2xl"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <i className="bi bi-journal-bookmark-fill text-base"></i>
                </span>
                <span>{ideaTicket}</span>
                <i className="bi bi-arrow-up-right text-xs text-slate-400"></i>
              </a>
            </div>
          </div>
        </div>

        {/* Baris Bawah: Quick Discovery Tags */}
        <div className="mt-12 flex flex-col justify-between gap-4 border-t border-border/60 pt-6 sm:flex-row sm:items-center text-sm">
          <p className="font-semibold text-slate-500">
            {pickPrompt}
          </p>
          <nav className="flex flex-wrap items-center gap-2 sm:gap-4 font-medium text-slate-700" aria-label="Eksplorasi cepat fitur">
            <a
              href="#features"
              className="rounded-lg bg-surface px-3 py-1.5 transition hover:bg-brand-500 hover:text-white"
            >
              Materi
            </a>
            <a
              href="#features"
              className="rounded-lg bg-surface px-3 py-1.5 transition hover:bg-brand-500 hover:text-white"
            >
              Kuis
            </a>
            <a
              href="#features"
              className="rounded-lg bg-surface px-3 py-1.5 transition hover:bg-brand-500 hover:text-white"
            >
              Suara
            </a>
            <a
              href="#practice"
              className="rounded-lg bg-surface px-3 py-1.5 transition hover:bg-brand-500 hover:text-white"
            >
              Presentasi
            </a>
            <a
              href="#practice"
              className="rounded-lg bg-surface px-3 py-1.5 transition hover:bg-brand-500 hover:text-white"
            >
              Wawancara
            </a>
          </nav>
        </div>
      </div>
    </section>
  );
}

