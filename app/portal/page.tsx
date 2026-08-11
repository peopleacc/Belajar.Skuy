import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SubscriptionDetailsCard from "@/components/SubscriptionDetailsCard";
import { LANG_COOKIE, getDict, normalizeLang } from "@/lib/i18n";
import { getSessionUser } from "@/lib/session";
import { getUserSubscriptionDetails } from "@/lib/subscriptions";

export const metadata: Metadata = {
  title: "Portal — belajar.skuy",
  description: "Pilih mode: generate course atau simulasi presentasi & wawancara.",
};

// Rounding + shadow card DISAMAKAN PERSIS dengan card dashboard & halaman harga.
const CARD = "rounded-sm bg-white shadow-card";

export default async function PortalPage() {
  const store = await cookies();
  const lang = normalizeLang(store.get(LANG_COOKIE)?.value);
  const t = getDict(lang);
  const p = t.portal;

  // Middleware sudah menjaga rute ini, tapi pengecekan di sini tetap perlu:
  // halaman tidak boleh bergantung pada satu lapis penjagaan saja.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const subDetails = await getUserSubscriptionDetails(user.id);

  const modes = [
    {
      ...p.modes.course,
      href: "/dashboard",
      badge: null as string | null,
    },
    {
      ...p.modes.simulation,
      href: "/simulation",
      badge: p.modes.simulation.badge,
    },
  ];

  return (
    <div className="min-h-screen bg-dominant text-slate-800">
      <SiteHeader lang={lang} t={t} anchorBase="/" user={user} />

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-32 md:px-10">
        <div className="mb-12 space-y-3">
          <p className="text-sm font-semibold text-brand-500">
            {p.greeting}, {user.fullName || user.username} 👋
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{p.title}</h1>
          <p className="max-w-2xl text-slate-500">{p.subtitle}</p>
        </div>

        {/* ── Pilihan mode ───────────────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-2">
          {modes.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`${CARD} group relative flex flex-col p-8 transition hover:-translate-y-0.5 hover:shadow-lg`}
            >
              {m.badge && (
                <span className="absolute right-6 top-6 rounded-full bg-brand-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-500">
                  {m.badge}
                </span>
              )}

              <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-2xl text-brand-500">
                <i className={`bi ${m.icon}`}></i>
              </span>

              <h2 className="mb-3 text-xl font-bold">{m.title}</h2>
              <p className="mb-8 flex-1 leading-relaxed text-slate-500">{m.desc}</p>

              <span className="flex items-center gap-2 text-sm font-semibold text-brand-500 transition-all group-hover:gap-3">
                {m.cta}
                <i className="bi bi-arrow-right"></i>
              </span>
            </Link>
          ))}
        </div>

        {/* ── Detail Paket & Pembayaran (planning-update-13) ──────── */}
        <div className="mt-8">
          <SubscriptionDetailsCard
            initialDetails={subDetails}
            t={t}
            lang={lang}
          />
        </div>
      </main>
    </div>
  );
}
