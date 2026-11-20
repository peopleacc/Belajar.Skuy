import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import SubscriptionDetailsCard from "@/components/SubscriptionDetailsCard";
import QuotaOverviewCard from "@/components/QuotaOverviewCard";
import { LANG_COOKIE, getDict, normalizeLang } from "@/lib/i18n";
import { getSessionUser } from "@/lib/session";
import { getUserSubscriptionDetails, getUserQuotaBalances } from "@/lib/subscriptions";

export const metadata: Metadata = {
  title: "Portal — belajar.skuy",
  description: "Pilih mode: generate course atau simulasi presentasi & wawancara.",
};

const PLAN_BADGES: Record<string, string> = {
  free: "Paket Gratis",
  premium: "Paket Premium",
  premium_presentasi: "Paket Presentasi Pro",
  premium_gabungan: "Paket Gabungan",
  pro: "Paket Pro Lengkap",
};

/**
 * Portal Dashboard belajar.skuy (Planning 8 - Task 8C-PT)
 * - Mengadopsi tata letak Redesign/portal.html:
 *   - Header salam personal + status indikator paket aktif (lampu hijau).
 *   - Mode Grid Ganda dengan ilustrasi 3D (Kursus AI vs Simulasi AI).
 *   - Telemetri kuota 4-pilar berbatang progres dinamis berdampingan dengan panel tagihan & invoice.
 * - Strict Zero Emojis (Aturan F): Menggunakan Bootstrap Icons.
 */
export default async function PortalPage() {
  const store = await cookies();
  const lang = normalizeLang(store.get(LANG_COOKIE)?.value);
  const t = getDict(lang);
  const isId = lang === "id";

  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Task 14B-SM: Single-pass subscription & quota memoization
  const subDetails = await getUserSubscriptionDetails(user.id);
  const quotaSummary = await getUserQuotaBalances(user.id, subDetails);

  const activePlanLabel =
    PLAN_BADGES[subDetails.planCode] ?? (isId ? `Paket ${subDetails.planCode}` : `${subDetails.planCode} Plan`);

  return (
    <div className="min-h-screen bg-dominant text-slate-800 transition-colors duration-300">
      {/* ── 1. Navbar "Blade & Blend" ────────────────────────────────────── */}
      <SiteHeader lang={lang} t={t} anchorBase="/" user={user} />

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 md:px-10">
        {/* ── 2. Page Heading & Active Plan Status ──────────────────────────── */}
        <div className="mb-10 flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
              {isId ? "Portal Aktivitas" : "Activity Portal"}
            </span>
            <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {isId ? "Ruang belajarmu." : "Your learning space."}
            </h1>
            <p className="mt-1 text-sm sm:text-base text-slate-600">
              {isId
                ? `Halo, ${user.fullName || user.username}. Mau mulai dari mana?`
                : `Hi, ${user.fullName || user.username}. Where shall we start?`}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {subDetails.isPaidActive ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{activePlanLabel}</span>
              </span>
            ) : subDetails.status === "canceled" ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700">
                <i className="bi bi-x-circle-fill text-rose-500"></i>
                <span>{isId ? "Langganan Dibatalkan" : "Subscription Canceled"}</span>
              </span>
            ) : subDetails.status === "past_due" ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-700">
                <i className="bi bi-exclamation-triangle-fill text-amber-500"></i>
                <span>{isId ? "Masa Aktif Berakhir" : "Past Due"}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700">
                <i className="bi bi-person-fill text-slate-400"></i>
                <span>{activePlanLabel}</span>
              </span>
            )}
          </div>
        </div>

        {/* ── 3. Mode Grid Ganda (Kursus AI vs Simulasi AI) ─────────────────── */}
        <section className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2" aria-label="Pilih mode kegiatan">
          {/* Card 1: Kursus AI */}
          <article className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-white p-7 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl sm:p-8">
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-12">
              <div className="sm:col-span-7 space-y-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-2xl text-brand-500">
                  <i className="bi bi-mortarboard-fill"></i>
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  {isId ? "Kursus AI" : "AI Courses"}
                </h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  {isId
                    ? "Susun kurikulum otomatis dari satu topik — materi bertingkat, video referensi, dan kuis cerdas."
                    : "Generate complete curriculum from one topic — staged chapters, reference videos, and quizzes."}
                </p>
                <div className="pt-2">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-brand-600"
                  >
                    <span>{isId ? "Buka Kursus" : "Open Courses"}</span>
                    <i className="bi bi-arrow-right text-xs"></i>
                  </Link>
                </div>
              </div>

              <div className="relative flex items-center justify-center sm:col-span-5">
                <Image
                  src="/images/study-illustration.webp"
                  alt="Ilustrasi Kursus AI"
                  width={720}
                  height={540}
                  className="h-auto max-h-[160px] w-auto object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            </div>
          </article>

          {/* Card 2: Simulasi AI */}
          <article className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-white p-7 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl sm:p-8">
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-12">
              <div className="sm:col-span-7 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-2xl text-brand-500">
                    <i className="bi bi-camera-video-fill"></i>
                  </span>
                  <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-600">
                    Beta
                  </span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  {isId ? "Simulasi Bicara" : "AI Simulation"}
                </h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  {isId
                    ? "Latih presentasi slide dan wawancara kerja dengan analisis ekspresi wajah, intonasi suara, dan rubrik AI."
                    : "Practice presentations and interviews with real-time facial kinematics, cadence telemetry, and AI scoring."}
                </p>
                <div className="pt-2">
                  <Link
                    href="/simulation"
                    className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-surface px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-brand-500"
                  >
                    <span>{isId ? "Mulai Latihan" : "Start Practice"}</span>
                    <i className="bi bi-arrow-right text-xs"></i>
                  </Link>
                </div>
              </div>

              <div className="relative flex items-center justify-center sm:col-span-5">
                <Image
                  src="/images/presentation-illustration.webp"
                  alt="Ilustrasi Simulasi Bicara AI"
                  width={720}
                  height={540}
                  className="h-auto max-h-[160px] w-auto object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            </div>
          </article>
        </section>

        {/* ── 4. Details Grid: Kuota Akun (Kiri) & Paket Tagihan (Kanan) ──── */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Kolom Kiri: Sisa Kuota 4 Pilar */}
          <div className="lg:col-span-7">
            <QuotaOverviewCard quota={quotaSummary} />
          </div>

          {/* Kolom Kanan: Rincian Paket, Tagihan & Pembayaran */}
          <div className="lg:col-span-5">
            <SubscriptionDetailsCard
              key={`${subDetails.planCode}-${subDetails.status}-${subDetails.updatedAt}-${subDetails.latestOrder?.id}-${subDetails.latestOrder?.status}`}
              initialDetails={subDetails}
              t={t}
              lang={lang}
              userName={user.fullName || user.username}
              userEmail={user.email ?? undefined}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
