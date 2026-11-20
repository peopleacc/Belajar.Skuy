import { cookies } from "next/headers";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HeroSpread from "@/components/landing/HeroSpread";
import FeatureLab from "@/components/landing/FeatureLab";
import PracticeSandbox from "@/components/landing/PracticeSandbox";
import HowItWorksStory from "@/components/landing/HowItWorksStory";
import PricingPlans from "@/components/PricingPlans";
import { currencyForLang, getPlans } from "@/lib/plans";
import { LANG_COOKIE, getDict, normalizeLang } from "@/lib/i18n";
import { getSessionUser } from "@/lib/session";

/**
 * Landing Page Utama belajar.skuy (Planning 8 - Task 8B-LP)
 * - Server Component (SSR) murni tanpa JavaScript payload berat.
 * - Mengintegrasikan Hero 3D Spread, Interactive Feature Lab, 1-Minute Practice Sandbox,
 *   dan Alur Cara Kerja Terpadu dari paket Redesign/ berbasis Tailwind CSS.
 * - Strict Zero Emojis (Aturan F): Memakai Bootstrap Icons.
 */
export default async function Home() {
  const store = await cookies();
  const lang = normalizeLang(store.get(LANG_COOKIE)?.value);
  const t = getDict(lang);
  const isId = lang === "id";

  // Data fetching di RSC secara paralel (zero flash, zero layout shift)
  const [user, plans] = await Promise.all([
    getSessionUser(),
    getPlans(currencyForLang(lang)),
  ]);

  return (
    <div className="min-h-screen bg-dominant text-slate-800 transition-colors duration-300">
      {/* ── 1. Navbar "Blade & Blend" (Task 8A-NV) ─────────────────────────── */}
      <SiteHeader lang={lang} t={t} user={user} />

      <main id="main" className="pt-[84px]">
        {/* ── 2. Hero Section 3D Spread (Task 8B-LP) ─────────────────────────── */}
        <HeroSpread lang={lang} t={t} />

        {/* ── 3. Interactive Feature Lab ─────────────────────────────────────── */}
        <FeatureLab lang={lang} t={t} />

        {/* ── 4. 1-Minute Practice Sandbox (On-Dark Stage) ───────────────────── */}
        <PracticeSandbox lang={lang} />

        {/* ── 5. Alur Cara Kerja & Visual Story ─────────────────────────────── */}
        <HowItWorksStory lang={lang} t={t} />

        {/* ── 6. Pratinjau Paket Belajar (Pricing Preview) ───────────────────── */}
        <section id="pricing" className="scroll-mt-24 border-y border-border/80 bg-surface-2 px-4 py-24 sm:px-6 md:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 space-y-3 text-center">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
                {isId ? "Investasi Belajar" : "Flexible Plans"}
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900">
                {isId ? "Ritmemu. Paketmu." : "Your pace. Your plan."}
              </h2>
              <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-500">
                {t.pricing.subtitle}
              </p>
            </div>

            <PricingPlans t={t} plans={plans} />

            <div className="mt-12 text-center">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-surface px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-brand-500"
              >
                <span>{isId ? "Bandingkan Seluruh 5 Paket Belajar & Rincian Fitur" : "Compare All 5 Plans & Feature Matrix"}</span>
                <i className="bi bi-arrow-right text-xs"></i>
              </Link>
            </div>
          </div>
        </section>

        {/* ── 7. Closing CTA Banner (On-Dark Section) ────────────────────────── */}
        <section className="closing-section on-dark-section bg-[#283157] px-4 py-20 text-white sm:px-6 md:px-10" data-header-dark="true">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 sm:flex-row">
            <div className="space-y-3 text-center sm:text-left">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
                {isId ? "Yuk, mulai sekarang." : "Let's begin today."}
              </h2>
              <p className="max-w-xl text-base text-[#d7daea]">
                {isId
                  ? "Dari rasa penasaran menjadi pemahaman nyata. Coba materi kursus dan simulasi AI pertamamu gratis."
                  : "From simple curiosity to true mastery. Start your first AI lesson and speaking simulation for free."}
              </p>
            </div>

            <Link
              href="/register"
              className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-8 text-base font-bold text-[#283157] shadow-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100 active:translate-y-0"
            >
              <span>{isId ? "Mulai Belajar Gratis" : "Start Learning Free"}</span>
              <i className="bi bi-arrow-up-right text-xs"></i>
            </Link>
          </div>
        </section>
      </main>

      {/* ── 8. Footer Terpadu (Task 8A-NV) ─────────────────────────────────── */}
      <SiteFooter t={t} />
    </div>
  );
}
