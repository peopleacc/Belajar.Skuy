import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PricingPlans from "@/components/PricingPlans";
import PricingComparisonMatrix from "@/components/PricingComparisonMatrix";
import { getSessionUser } from "@/lib/session";
import { currencyForLang, getPlans } from "@/lib/plans";
import { LANG_COOKIE, getDict, normalizeLang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Harga & Paket — belajar.skuy",
  description:
    "Bandingkan paket Gratis, Premium, Premium Presentasi, Premium Gabungan, dan Pro belajar.skuy. Mulai gratis tanpa kartu kredit.",
};

const isProd =
  process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true" ||
  process.env.MIDTRANS_IS_PRODUCTION === "true";

const snapJsUrl = isProd
  ? "https://app.midtrans.com/snap/snap.js"
  : "https://app.sandbox.midtrans.com/snap/snap.js";

const snapClientKey =
  process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ??
  process.env.MIDTRANS_CLIENT_KEY ??
  "";

export default async function PricingPage() {
  const store = await cookies();
  const lang = normalizeLang(store.get(LANG_COOKIE)?.value);
  const t = getDict(lang);
  const p = t.pricingPage;

  const [user, plans] = await Promise.all([
    getSessionUser(),
    getPlans(currencyForLang(lang)),
  ]);

  const currentIndex = user
    ? (() => {
        const i = plans.findIndex((pl) => pl.code === user.planCode);
        return i === -1 ? 0 : i;
      })()
    : null;

  return (
    <div className="min-h-screen bg-[#f2f3f7] text-[#272b3f] font-sans flex flex-col transition-colors">
      {/* Midtrans Snap Popup Script */}
      {snapClientKey && (
        <Script
          src={snapJsUrl}
          data-client-key={snapClientKey}
          strategy="afterInteractive"
        />
      )}

      {/* Shared SiteHeader with Adaptive Dark Detection */}
      <SiteHeader lang={lang} t={t} anchorBase="/" user={user} />

      <main className="flex-1">
        {/* ── 1. Hero Spread ──────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-8 pt-24 sm:pt-28 pb-12 sm:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-1 text-xs font-bold text-[#283157]">
                <i className="bi bi-tags-fill"></i>
                <span>{p.badge}</span>
              </span>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-[#283157]">
                Belajar sesuai ritmemu.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                Mulai gratis tanpa kartu kredit. Tambah ruang untuk modul materi terstruktur dan latihan simulasi bicara kapan saja.
              </p>
              <div className="pt-2">
                <a
                  href="#compare"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#283157] hover:underline"
                >
                  <span>Bandingkan rincian 13 fitur</span>
                  <i className="bi bi-arrow-down-circle"></i>
                </a>
              </div>
            </div>

            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-64 h-52 sm:w-80 sm:h-64">
                <Image
                  src="/images/study-illustration.webp"
                  alt="Ilustrasi Belajar 3D"
                  fill
                  className="object-contain animate-book-float drop-shadow-2xl"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Pricing Plans Section ────────────────────────────── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12" id="plans">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#283157]">
                Pilih paketmu.
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Tersedia opsi bayar bulanan, 6 bulan (Diskon 20%), dan 1 tahun (Diskon 30%).
              </p>
            </div>
          </div>

          <PricingPlans
            t={t}
            plans={plans}
            currentIndex={currentIndex}
            isLoggedIn={!!user}
          />
        </section>

        {/* ── 3. Comparison Matrix Section ────────────────────────── */}
        <section
          id="compare"
          className="max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 border-t border-slate-200/80"
        >
          <div className="mb-8 sm:mb-12 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Transparansi Penuh
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#283157]">
              Bandingkan sebelum memilih.
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Lihat seluruh perbandingan kuota harian, kedalaman materi, modul latihan suara AI, dan kapasitas simulasi bicara di tiap paket.
            </p>
          </div>

          <PricingComparisonMatrix />
        </section>

        {/* ── 4. FAQ Accordion Section ────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-8 py-12 sm:py-16 border-t border-slate-200/80">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Pusat Bantuan
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#283157]">
                {p.faqTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Jawaban ringkas seputar akun gratis, cara kerja kurasi materi AI, dan kebijakan perpindahan paket.
              </p>
            </div>

            <div className="lg:col-span-8 space-y-3">
              {p.faq.map((item, idx) => (
                <details
                  key={idx}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition"
                >
                  <summary className="flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-800 cursor-pointer list-none">
                    <span>{item.q}</span>
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-open:rotate-45 transition-transform duration-200 text-sm">
                      <i className="bi bi-plus"></i>
                    </span>
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. Closing CTA Banner ───────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-8 pb-16 sm:pb-24">
          <div className="rounded-3xl bg-[#283157] text-white p-8 sm:p-12 shadow-2xl relative overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="md:col-span-8 space-y-4 relative z-10">
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                Mulai kecil.<br />Makin paham.
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed max-w-lg">
                Coba dulu paket Gratis untuk merasakan kurikulum terstruktur dan kuis cerdas, lalu temukan ritme belajarmu.
              </p>
              <div className="pt-2">
                <Link
                  href={user ? "/portal" : "/register"}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white hover:bg-slate-100 text-[#283157] px-7 py-3 text-xs sm:text-sm font-bold shadow-lg transition active:scale-95"
                >
                  <span>{user ? "Buka Portal Ruang Belajar" : "Mulai Gratis Sekarang"}</span>
                  <i className="bi bi-arrow-right"></i>
                </Link>
              </div>
            </div>

            <div className="md:col-span-4 flex justify-center relative z-10">
              <div className="relative w-44 h-36 sm:w-56 sm:h-44">
                <Image
                  src="/images/presentation-illustration.webp"
                  alt="Ilustrasi Presentasi 3D"
                  fill
                  className="object-contain animate-book-float-slow drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Shared SiteFooter */}
      <SiteFooter t={t} anchorBase="/" />
    </div>
  );
}
