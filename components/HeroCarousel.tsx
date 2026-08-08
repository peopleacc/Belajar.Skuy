"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Dict } from "@/lib/i18n";

// Rounding + shadow card DISAMAKAN PERSIS dengan card dashboard (lihat app/page.tsx).
const CARD = "rounded-sm bg-white shadow-card";

const AUTO_ADVANCE_MS = 6500;
const SLIDE_COUNT = 2;

// Tinggi batang tetap (bukan acak tiap render — supaya SSR/hidration tidak mismatch)
// dianimasikan lewat CSS (lihat <style> di bawah), meniru VoiceFrequency.tsx tapi
// TANPA Web Audio API — ini cuma mockup marketing, tidak ada mic sungguhan di landing page.
const VOICE_BAR_HEIGHTS = [30, 55, 80, 45, 65, 90, 50, 35, 70, 60, 40, 85, 55, 30, 65, 45, 75, 50, 35, 60];

function Slide1({ t }: { t: Dict }) {
  const h = t.hero;
  return (
    <div className="grid items-center gap-16 lg:grid-cols-2">
      <div className="space-y-7">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/15 bg-brand-500/5 px-4 py-2 text-xs font-bold text-brand-500">
          <i className="bi bi-stars"></i>
          {h.badge}
        </span>

        <h1 className="text-4xl font-extrabold leading-[1.12] tracking-tight md:text-5xl lg:text-[3.4rem]">
          {h.titleTop}
          <br />
          <span className="text-brand-500">{h.titleBottom}</span>
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-slate-500">{h.desc}</p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/register"
            className="rounded-xl bg-brand-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
          >
            {h.ctaPrimary}
          </Link>
          <a
            href="#how"
            className="flex items-center gap-2 rounded-xl border border-border bg-white px-7 py-3.5 text-base font-semibold transition hover:bg-surface-2"
          >
            <i className="bi bi-play-circle"></i>
            {h.ctaSecondary}
          </a>
        </div>

        <div className="flex items-center gap-4 border-t border-border pt-8">
          <div className="flex -space-x-2.5">
            {["bi-person-fill", "bi-person-fill", "bi-person-fill"].map((ic, i) => (
              <span
                key={i}
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-surface bg-brand-500/10 text-brand-500"
              >
                <i className={`bi ${ic}`}></i>
              </span>
            ))}
          </div>
          <div>
            <p className="text-sm font-bold">{h.proofTitle}</p>
            <p className="text-xs text-slate-500">{h.proofSub}</p>
          </div>
        </div>
      </div>

      {/* Pratinjau UI — dibangun dari token yang sama, tanpa gambar eksternal */}
      <div className="relative hidden lg:block">
        <div className={`${CARD} p-6`}>
          <p className="text-base font-bold">{h.mockTitle}</p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
            {h.mockPlaceholder}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">{h.mockChapter}</span>
            <span className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white">
              {h.mockButton}
            </span>
          </div>
          <div className="mt-6 space-y-2.5">
            {[92, 68, 45].map((w) => (
              <div key={w} className="h-2.5 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500/50" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </div>

        <div className={`${CARD} absolute -left-6 top-10 p-4`}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <i className="bi bi-graph-up-arrow"></i>
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {h.mockProgressLabel}
              </p>
              <p className="text-lg font-bold text-brand-500">+85%</p>
            </div>
          </div>
        </div>

        <div className="absolute -right-6 bottom-10 rounded-sm bg-brand-500 p-4 shadow-card">
          <div className="flex items-center gap-3 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <i className="bi bi-robot"></i>
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{h.mockAiLabel}</p>
              <p className="text-sm font-bold">{h.mockAiValue}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Slide 2 (Fitur EA) — showcase simulasi. Elemen mockup SENGAJA meniru elemen nyata
// & terbukti di SessionRunner.tsx/VoiceFrequency.tsx (Presenter View, Voice Frequency)
// alih-alih mockup course generation yang di-reskin — supaya terasa "seperti aplikasi
// simulasi", persis DoD Fitur EA di planning-update-12.md.
function Slide2({ t }: { t: Dict }) {
  const s = t.hero.slide2;
  return (
    <div className="grid items-center gap-16 lg:grid-cols-2">
      <div className="space-y-7">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/15 bg-brand-500/5 px-4 py-2 text-xs font-bold text-brand-500">
          <i className="bi bi-mic-fill"></i>
          {s.badge}
        </span>

        <h1 className="text-4xl font-extrabold leading-[1.12] tracking-tight md:text-5xl lg:text-[3.4rem]">
          {s.titleTop}
          <br />
          <span className="text-brand-500">{s.titleBottom}</span>
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-slate-500">{s.desc}</p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/register"
            className="rounded-xl bg-brand-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
          >
            {s.ctaPrimary}
          </Link>
          <a
            href="#how"
            className="flex items-center gap-2 rounded-xl border border-border bg-white px-7 py-3.5 text-base font-semibold transition hover:bg-surface-2"
          >
            <i className="bi bi-play-circle"></i>
            {s.ctaSecondary}
          </a>
        </div>

        <div className="flex items-center gap-4 border-t border-border pt-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
            <i className="bi bi-graph-up-arrow"></i>
          </span>
          <div>
            <p className="text-sm font-bold">{s.proofTitle}</p>
            <p className="text-xs text-slate-500">{s.proofSub}</p>
          </div>
        </div>
      </div>

      <div className="relative hidden lg:block">
        <div className={`${CARD} space-y-4 p-6`}>
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <p className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {s.presenterLabel}
            </p>
            <div className="relative mt-2 flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-ink-900/90">
              <i className="bi bi-person-video3 text-5xl text-white/25"></i>
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                <span className="hero-live-dot h-1.5 w-1.5 rounded-full bg-white" /> {s.presentingBadge}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-slate-400">{s.presenterNote}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {s.voiceLabel}
              <span className="text-xs normal-case">🎙️</span>
            </p>
            <div className="mt-3 flex h-16 items-end gap-[3px]">
              {VOICE_BAR_HEIGHTS.map((height, i) => (
                <span
                  key={i}
                  className="hero-voice-bar w-1 flex-1 rounded-full bg-brand-500"
                  style={{ "--bar-h": `${height}%`, animationDelay: `${(i % 8) * 90}ms` } as React.CSSProperties}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {s.volumeLabel} {s.volumeValue}
            </p>
          </div>
        </div>

        <div className={`${CARD} absolute -right-6 top-4 max-w-[240px] p-4`}>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span className="hero-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {s.questionLabel}
            <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-500">
              {s.questionBadge}
            </span>
          </p>
          <p className="mt-2 text-sm font-medium leading-snug text-slate-700">{s.questionText}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Fitur EA (planning-update-12) — hero jadi carousel 2 slide: slide 1 konten yang
 * sudah ada (regresi nol, dipindah apa adanya), slide 2 showcase simulasi.
 *
 * Auto-geser via setInterval, DIPAUSE saat hover (bukan di-clear permanen — timer
 * jalan lagi begitu kursor keluar). Panah & dot manual keduanya lewat `goTo()` yang
 * sama, supaya interaksi manual otomatis mengatur ulang timer (tidak "berebut"
 * dengan auto-advance berikutnya).
 *
 * CROSSFADE (opacity), BUKAN geser translateX horizontal — dicoba geser dulu, tapi
 * selama durasi transisi (500ms) DUA slide sama-sama sebagian terlihat berdampingan
 * di viewport yang sama (headline slide 1 terpotong bersisian dgn badge slide 2) →
 * kelihatan "nabrak"/berantakan, krn ini teks besar bukan gambar (beda dgn carousel
 * gambar yang aman digeser). Kedua slide DITUMPUK di sel grid yang SAMA
 * (`grid-area:1/1`, trik "stacking grid" — container otomatis setinggi slide
 * terTINGGI, tanpa perlu `position:absolute` yg butuh tinggi manual) lalu cuma
 * `opacity`+`pointer-events` slide aktif yang di-toggle. Slide nonaktif juga
 * `aria-hidden` supaya screen reader tak baca dua headline sekaligus.
 */
export default function HeroCarousel({ t }: { t: Dict }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((index: number) => {
    setActive(((index % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT);
  }, []);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => {
      setActive((a) => (a + 1) % SLIDE_COUNT);
    }, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, active]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        .hero-voice-bar {
          height: 8px;
          animation: hero-voice-pulse 1.1s ease-in-out infinite alternate;
        }
        @keyframes hero-voice-pulse {
          from { height: 8px; opacity: 0.45; }
          to { height: var(--bar-h); opacity: 1; }
        }
        .hero-live-dot { animation: hero-live-blink 1.4s ease-in-out infinite; }
        @keyframes hero-live-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-voice-bar, .hero-live-dot { animation: none; }
        }
      `}</style>

      <div className="grid">
        <div
          className="col-start-1 row-start-1 transition-opacity duration-700 ease-out"
          style={{ opacity: active === 0 ? 1 : 0, pointerEvents: active === 0 ? "auto" : "none" }}
          aria-hidden={active !== 0}
        >
          <Slide1 t={t} />
        </div>
        <div
          className="col-start-1 row-start-1 transition-opacity duration-700 ease-out"
          style={{ opacity: active === 1 ? 1 : 0, pointerEvents: active === 1 ? "auto" : "none" }}
          aria-hidden={active !== 1}
        >
          <Slide2 t={t} />
        </div>
      </div>

      {/* Panah manual DIPINDAH ke bawah carousel (bukan lagi menimpa konten di atasnya) —
          kartu dekoratif terapung slide 1/2 (mis. -left-6/-right-6) duduk di zona yang
          sama dengan panah lama (left-0/right-0 + translate 16px), jadi keduanya nabrak
          di layar lg. Sekarang panah sejajar dot di baris kontrol tersendiri, otomatis
          "jauh" dari carousel karena diberi jarak `mt-12` + tak lagi absolute-overlay. */}
      <div className="mt-12 flex items-center justify-center gap-5">
        <button
          type="button"
          aria-label={t.hero.carouselPrev}
          onClick={() => goTo(active - 1)}
          className="flex items-center justify-center rounded-full border border-border bg-white p-2.5 text-slate-500 shadow-card transition hover:text-brand-500"
        >
          <i className="bi bi-chevron-left"></i>
        </button>

        <div className="flex items-center gap-2">
          {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t.hero.carouselGoTo.replace("{n}", String(i + 1))}
              aria-current={active === i}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all ${
                active === i ? "w-7 bg-brand-500" : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label={t.hero.carouselNext}
          onClick={() => goTo(active + 1)}
          className="flex items-center justify-center rounded-full border border-border bg-white p-2.5 text-slate-500 shadow-card transition hover:text-brand-500"
        >
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  );
}
