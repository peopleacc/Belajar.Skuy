import { cookies } from "next/headers";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PricingPlans from "@/components/PricingPlans";
import HeroCarousel from "@/components/HeroCarousel";
import { currencyForLang, getPlans } from "@/lib/plans";
import { LANG_COOKIE, getDict, normalizeLang } from "@/lib/i18n";

// Rounding + shadow card DISAMAKAN PERSIS dengan card dashboard
// (lihat NewCourseCard.tsx / dashboard/page.tsx: "rounded-sm bg-white ... shadow-card").
const CARD = "rounded-sm bg-white shadow-card";

export default async function Home() {
  const store = await cookies();
  const lang = normalizeLang(store.get(LANG_COOKIE)?.value);
  const t = getDict(lang);
  const plans = await getPlans(currencyForLang(lang));

  return (
    <div className="min-h-screen bg-dominant text-slate-800">
      <SiteHeader lang={lang} t={t} />

      <main className="pt-20">
        {/* ── Hero (Fitur EA — carousel: slide 1 konten lama, slide 2 showcase simulasi) ── */}
        <section className="px-5 py-20 md:px-10 md:py-28">
          <div className="mx-auto max-w-7xl">
            <HeroCarousel t={t} />
          </div>
        </section>

        {/* ── Fitur ──────────────────────────────────────────────── */}
        <section id="features" className="border-y border-border bg-surface-2 px-5 py-24 md:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 space-y-3 text-center">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
                {t.features.eyebrow}
              </span>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                {t.features.title}
              </h2>
              <p className="mx-auto max-w-2xl text-slate-500">{t.features.subtitle}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {t.features.items.map((f) => (
                <div
                  key={f.title}
                  className={`${CARD} flex flex-col p-8 transition duration-200 hover:-translate-y-1 hover:shadow-lg`}
                >
                  <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-2xl text-brand-500">
                    <i className={`bi ${f.icon}`}></i>
                  </span>
                  <h3 className="mb-3 text-xl font-bold">{f.title}</h3>
                  <p className="mb-6 flex-1 leading-relaxed text-slate-500">{f.desc}</p>
                  <ul className="space-y-3 pt-2">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-3 text-sm font-medium">
                        <i className="bi bi-check-circle-fill text-brand-500"></i>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Cara kerja ─────────────────────────────────────────── */}
        <section id="how" className="px-5 py-24 md:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-20 space-y-3 text-center">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
                {t.how.eyebrow}
              </span>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t.how.title}</h2>
              <p className="mx-auto max-w-2xl text-slate-500">{t.how.subtitle}</p>
            </div>

            <div className="space-y-20">
              {t.how.steps.map((s, i) => (
                <div
                  key={s.title}
                  className={`flex flex-col items-center gap-12 lg:gap-20 ${
                    i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"
                  }`}
                >
                  <div className="flex-1 space-y-5">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-white text-xl font-bold text-brand-500">
                      {i + 1}
                    </span>
                    <h3 className="text-2xl font-bold tracking-tight md:text-3xl">{s.title}</h3>
                    <p className="text-lg leading-relaxed text-slate-500">{s.desc}</p>
                    <p className="flex items-center gap-3 font-semibold text-brand-500">
                      <i className={`bi ${s.icon}`}></i>
                      {s.note}
                    </p>
                  </div>

                  <div className="w-full flex-1">
                    <div className={`${CARD} flex aspect-video items-center justify-center`}>
                      <i className={`bi ${s.icon} text-6xl text-brand-500/25`}></i>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Harga ──────────────────────────────────────────────── */}
        <section id="pricing" className="border-y border-border bg-surface-2 px-5 py-24 md:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 space-y-3 text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t.pricing.title}</h2>
              <p className="mx-auto max-w-2xl text-slate-500">{t.pricing.subtitle}</p>
            </div>

            <PricingPlans t={t} plans={plans} />

            <div className="mt-10 text-center">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-500 transition hover:gap-3"
              >
                {t.pricing.seeDetail}
                <i className="bi bi-arrow-right"></i>
              </Link>
            </div>
          </div>
        </section>

        {/* ── CTA penutup ────────────────────────────────────────── */}
        {/* ink-900 = token yang sengaja gelap konstan di kedua tema */}
        <section className="px-5 py-24 md:px-10">
          <div className="mx-auto max-w-7xl rounded-sm bg-ink-900 p-12 text-center shadow-card md:p-20">
            <h2 className="mx-auto max-w-3xl text-3xl font-bold leading-tight tracking-tight text-light md:text-4xl">
              {t.cta.title}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-light-muted">{t.cta.desc}</p>
            <Link
              href="/register"
              className="mt-10 inline-block rounded-xl bg-white px-10 py-4 text-base font-bold text-brand-500 transition hover:opacity-90"
            >
              {t.cta.button}
            </Link>
            <p className="mt-5 text-sm text-light-muted">{t.cta.note}</p>
          </div>
        </section>

        <SiteFooter t={t} />
      </main>
    </div>
  );
}
