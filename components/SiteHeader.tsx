"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Tutup menu saat berpindah halaman
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Tutup menu saat klik di luar area menu
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) {
      document.addEventListener("mousedown", onClick);
    }
    return () => document.removeEventListener("mousedown", onClick);
  }, [mobileMenuOpen]);

  return (
    <nav className="fixed inset-x-0 top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 md:px-10">
        <div className="flex items-center gap-6 lg:gap-10">
          {/* Logo Brand: di HP hanya logo icon kotak yang tampil, judul disembunyikan */}
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-500 text-white shadow-sm">
              <i className="bi bi-book text-xl"></i>
            </span>
            <span className="hidden sm:inline text-lg font-bold tracking-tight">
              belajar<span className="text-brand-500">.skuy</span>
            </span>
          </Link>

          {/* Navigasi Desktop */}
          <div className="hidden items-center gap-8 md:flex">
            <Link
              href="/"
              className="text-sm font-semibold text-slate-500 transition hover:text-brand-500"
            >
              {t.nav.home ?? "Home"}
            </Link>
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

        <div className="flex items-center gap-2 sm:gap-3">
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
                home: t.nav.home ?? "Home",
                pricing: t.nav.pricing,
              }}
            />
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:text-brand-500 sm:block"
              >
                {t.nav.login}
              </Link>
              <Link
                href="/register"
                className="hidden rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 sm:inline-flex"
              >
                {t.nav.register}
              </Link>
            </>
          )}

          {/* Tombol Menu Mobile untuk toggle dropdown link navigasi */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Menu navigasi"
            aria-expanded={mobileMenuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-slate-700 transition hover:bg-surface-2 active:scale-95 md:hidden"
          >
            <i className={`bi ${mobileMenuOpen ? "bi-x-lg" : "bi-list"} text-lg`}></i>
          </button>
        </div>
      </div>

      {/* Dropdown Menu Mobile: memuat seluruh URL link navigasi lainnya */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="absolute inset-x-0 top-full border-b border-border bg-surface/98 px-5 py-4 shadow-xl backdrop-blur-md md:hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex flex-col gap-1">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-surface-2 hover:text-brand-500"
            >
              <i className="bi bi-house-door text-base text-slate-400"></i>
              {t.nav.home ?? "Home"}
            </Link>

            {user ? (
              <Link
                href="/portal"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-surface-2 hover:text-brand-500"
              >
                <i className="bi bi-grid-1x2 text-base text-slate-400"></i>
                {t.nav.portal}
              </Link>
            ) : (
              <a
                href={`${anchorBase}#features`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-surface-2 hover:text-brand-500"
              >
                <i className="bi bi-stars text-base text-slate-400"></i>
                {t.nav.features}
              </a>
            )}

            <a
              href={`${anchorBase}#how`}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-surface-2 hover:text-brand-500"
            >
              <i className="bi bi-lightbulb text-base text-slate-400"></i>
              {t.nav.how}
            </a>

            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-surface-2 hover:text-brand-500"
            >
              <i className="bi bi-tag text-base text-slate-400"></i>
              {t.nav.pricing}
            </Link>

            {!user && (
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-surface-2"
                >
                  <i className="bi bi-box-arrow-in-right"></i>
                  {t.nav.login}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-600"
                >
                  <i className="bi bi-person-plus-fill"></i>
                  {t.nav.register}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
