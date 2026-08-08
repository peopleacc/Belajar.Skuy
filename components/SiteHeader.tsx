import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import UserMenu from "@/components/UserMenu";
import type { Dict, Lang } from "@/lib/i18n";
import type { SessionUser } from "@/lib/session";

// Header publik dipakai bersama oleh landing (/) dan halaman harga (/pricing)
// supaya tidak ada dua salinan yang lama-lama beda sendiri.
// `anchorBase` = tujuan link seksi. Di landing cukup anchor ("#features"),
// di halaman lain harus kembali ke landing dulu ("/#features").
//
// Fitur BG — sadar sesi. Sudah login: menu "Fitur" (anchor pemasaran, tak berguna
// bagi user) diganti "Portal", dan tombol Masuk/Daftar diganti avatar profil.
export default function SiteHeader({
  lang,
  t,
  anchorBase = "",
  user = null,
}: {
  lang: Lang;
  t: Dict;
  anchorBase?: string;
  user?: SessionUser | null;
}) {
  return (
    <nav className="fixed inset-x-0 top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-10">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-500 text-white">
              <i className="bi bi-book text-xl"></i>
            </span>
            <span className="text-lg font-bold tracking-tight">
              belajar<span className="text-brand-500">.skuy</span>
            </span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            {user ? (
              <Link
                href="/portal"
                className="text-sm font-semibold text-slate-500 transition hover:text-brand-500"
              >
                {t.nav.portal}
              </Link>
            ) : (
              <a
                href={`${anchorBase}#features`}
                className="text-sm font-semibold text-slate-500 transition hover:text-brand-500"
              >
                {t.nav.features}
              </a>
            )}
            <a
              href={`${anchorBase}#how`}
              className="text-sm font-semibold text-slate-500 transition hover:text-brand-500"
            >
              {t.nav.how}
            </a>
            <Link
              href="/pricing"
              className="text-sm font-semibold text-slate-500 transition hover:text-brand-500"
            >
              {t.nav.pricing}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LanguageToggle lang={lang} />
          <ThemeToggle />
          {user ? (
            <UserMenu
              fullName={user.fullName}
              username={user.username}
              avatarUrl={user.avatarUrl}
              labels={{
                portal: t.menu.portal,
                editProfile: t.menu.editProfile,
                signOut: t.menu.signOut,
                noName: t.menu.noName,
              }}
            />
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-brand-500 sm:block"
              >
                {t.nav.login}
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
              >
                {t.nav.register}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
