import Link from "next/link";
import type { Dict } from "@/lib/i18n";

// Footer publik dipakai bersama landing (/) dan halaman harga (/pricing).
export default function SiteFooter({
  t,
  anchorBase = "",
}: {
  t: Dict;
  anchorBase?: string;
}) {
  return (
    <footer className="border-t border-border bg-surface px-5 py-20 md:px-10">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-4">
        <div className="space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-500 text-white">
              <i className="bi bi-book text-xl"></i>
            </span>
            <span className="text-lg font-bold tracking-tight">
              belajar<span className="text-brand-500">.skuy</span>
            </span>
          </div>
          <p className="leading-relaxed text-slate-500">{t.footer.desc}</p>
        </div>

        <div>
          <h4 className="mb-6 text-xs font-bold uppercase tracking-[0.2em]">
            {t.footer.services}
          </h4>
          <ul className="space-y-3 text-slate-500">
            {t.footer.servicesItems.map((s) => (
              <li key={s}>
                <a
                  href={`${anchorBase}#features`}
                  className="transition hover:text-brand-500"
                >
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-6 text-xs font-bold uppercase tracking-[0.2em]">
            {t.footer.company}
          </h4>
          <ul className="space-y-3 text-slate-500">
            {t.footer.companyItems.map((s) => (
              <li key={s}>
                <a href="#" className="transition hover:text-brand-500">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-6 text-xs font-bold uppercase tracking-[0.2em]">
            {t.nav.pricing}
          </h4>
          <Link
            href="/pricing"
            className="mb-3 block text-slate-500 transition hover:text-brand-500"
          >
            {t.pricing.seeDetail}
          </Link>
          <Link
            href="/register"
            className="block rounded-xl bg-brand-500 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
          >
            {t.nav.register}
          </Link>
          <Link
            href="/login"
            className="mt-3 block rounded-xl border border-border py-3.5 text-center text-sm font-semibold transition hover:bg-surface-2"
          >
            {t.nav.login}
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-16 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} {t.footer.copyright}
        </p>
        <div className="flex gap-6 text-xs font-semibold text-slate-500">
          <a href="#" className="transition hover:text-brand-500">
            {t.footer.privacy}
          </a>
          <a href="#" className="transition hover:text-brand-500">
            {t.footer.terms}
          </a>
        </div>
      </div>
    </footer>
  );
}
