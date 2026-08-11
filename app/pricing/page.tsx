import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PricingPlans from "@/components/PricingPlans";
import { getSessionUser } from "@/lib/session";
import { currencyForLang, getPlans } from "@/lib/plans";
import { LANG_COOKIE, getDict, normalizeLang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Harga — belajar.skuy",
  description:
    "Bandingkan paket Gratis, Premium, dan Pro belajar.skuy. Mulai gratis tanpa kartu kredit.",
};

// Rounding + shadow card DISAMAKAN PERSIS dengan card dashboard.
const CARD = "rounded-sm bg-white shadow-card";

// Sel tabel: "yes"/"no" jadi ikon, selain itu ditampilkan apa adanya.
function Cell({ value }: { value: string }) {
  if (value === "yes")
    return <i className="bi bi-check-circle-fill text-base text-brand-500"></i>;
  if (value === "no")
    return <i className="bi bi-dash-lg text-base text-slate-300"></i>;
  return <span className="text-sm font-medium">{value}</span>;
}

export default async function PricingPage() {
  const store = await cookies();
  const lang = normalizeLang(store.get(LANG_COOKIE)?.value);
  const t = getDict(lang);
  const p = t.pricingPage;

  // Halaman ini publik, tapi kalau user sedang login kartu paketnya ditandai dan
  // navbar menampilkan profil. Sesi bisa dibaca karena `/pricing` masuk matcher
  // middleware (lihat middleware.ts).
  const [user, plans] = await Promise.all([
    getSessionUser(),
    getPlans(currencyForLang(lang)),
  ]);

  // Fitur CB — indeks paket TIDAK lagi di-hardcode; urutannya dari `sort_order`
  // di database, jadi menambah paket baru tidak perlu menyentuh kode ini.
  const currentIndex = user
    ? (() => {
        const i = plans.findIndex((pl) => pl.code === user.planCode);
        return i === -1 ? 0 : i;
      })()
    : null;

  return (
    <div className="min-h-screen bg-dominant text-slate-800">
      {/* Halaman ini bukan landing, jadi anchor seksi harus balik ke "/" dulu */}
      <SiteHeader lang={lang} t={t} anchorBase="/" user={user} />

      <main className="pt-20">
        {/* ── Judul ──────────────────────────────────────────────── */}
        <section className="px-5 pb-4 pt-20 text-center md:px-10">
          <div className="mx-auto max-w-3xl space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/15 bg-brand-500/5 px-4 py-2 text-xs font-bold text-brand-500">
              <i className="bi bi-tags-fill"></i>
              {p.badge}
            </span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              {p.title}
            </h1>
            <p className="text-lg leading-relaxed text-slate-500">{p.subtitle}</p>
          </div>
        </section>

        {/* ── Kartu paket ────────────────────────────────────────── */}
        <section className="px-5 py-14 md:px-10">
          <div className="mx-auto max-w-7xl">
            <PricingPlans t={t} plans={plans} currentIndex={currentIndex} isLoggedIn={!!user} />
          </div>
        </section>

        {/* ── Tabel perbandingan ─────────────────────────────────── */}
        <section className="border-y border-border bg-surface-2 px-5 py-24 md:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 space-y-3 text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                {p.compareTitle}
              </h2>
              <p className="text-slate-500">{p.compareSubtitle}</p>
            </div>

            {/* overflow-x-auto: di layar sempit tabel yang menggeser, bukan halamannya */}
            <div className={`${CARD} overflow-x-auto`}>
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                      {p.colFeature}
                    </th>
                    {t.pricing.plans.map((plan, i) => (
                      <th
                        key={plan.name}
                        className={`px-6 py-5 text-center text-sm font-bold ${
                          // Fitur EC: popular = index 3 (Premium Gabungan)
                          i === 3 ? "text-brand-500" : ""
                        }`}
                      >
                        {plan.name}
                        {i === 3 && (
                          <span className="ml-2 rounded-full bg-brand-500/10 px-2 py-0.5 text-[9px] uppercase tracking-widest">
                            ★
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.rows.map((row, ri) => (
                    <tr
                      key={row.label}
                      className={ri % 2 === 1 ? "bg-surface-2/60" : undefined}
                    >
                      <td className="px-6 py-4 text-sm font-medium">{row.label}</td>
                      {row.values.map((v, vi) => (
                        <td key={vi} className="px-6 py-4 text-center">
                          <Cell value={v} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section className="px-5 py-24 md:px-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-12 text-center text-3xl font-bold tracking-tight md:text-4xl">
              {p.faqTitle}
            </h2>
            <div className="space-y-4">
              {p.faq.map((item) => (
                <details key={item.q} className={`${CARD} group p-6`}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {item.q}
                    <i className="bi bi-plus-lg shrink-0 text-brand-500 transition-transform group-open:rotate-45"></i>
                  </summary>
                  <p className="mt-4 leading-relaxed text-slate-500">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA penutup (ink-900 = gelap konstan di kedua tema) ─── */}
        <section className="px-5 pb-24 md:px-10">
          <div className="mx-auto max-w-7xl rounded-sm bg-ink-900 p-12 text-center shadow-card md:p-20">
            <h2 className="mx-auto max-w-3xl text-3xl font-bold leading-tight tracking-tight text-light md:text-4xl">
              {p.ctaTitle}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-light-muted">{p.ctaDesc}</p>
            <Link
              href="/register"
              className="mt-10 inline-block rounded-xl bg-white px-10 py-4 text-base font-bold text-brand-500 transition hover:opacity-90"
            >
              {p.ctaButton}
            </Link>
            <p className="mt-5 text-sm text-light-muted">{t.cta.note}</p>
          </div>
        </section>

        <SiteFooter t={t} anchorBase="/" />
      </main>
    </div>
  );
}
