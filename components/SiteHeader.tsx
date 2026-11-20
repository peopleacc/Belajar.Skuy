"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LanguageToggle from "@/components/LanguageToggle";
import UserMenu from "@/components/UserMenu";
import BrandLogo from "@/components/BrandLogo";
import type { Dict, Lang } from "@/lib/i18n";
import type { SessionUser } from "@/lib/session";

/**
 * SiteHeader - Navbar "Blade & Blend" (Planning 8 - Task 8A-NV)
 * - Blade: Ketinggian presisi 84px, border-b tipis terkalibrasi, tipografi tajam.
 * - Blend: Glassmorphism backdrop-blur, mendeteksi section gelap (Simulasi/Closing)
 *   untuk transisi adaptif on-dark secara mulus.
 * - Session-Aware: Tamu melihat CTA Masuk/Mulai gratis, pengguna login melihat UserMenu & Portal.
 * - Strict Zero Emojis (Aturan F): Seluruh ikon menggunakan Bootstrap Icons (bi).
 */
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
  const [isOnDark, setIsOnDark] = useState(false);
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

  // ESC key listener untuk menutup menu mobile
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  // Adaptive Section Blending: mendeteksi elemen section di bawah navbar
  useEffect(() => {
    function handleScroll() {
      if (typeof window === "undefined") return;
      // Ambil elemen tepat di tengah horizontal navbar pada offset 44px
      const el = document.elementFromPoint(
        window.innerWidth / 2,
        Math.min(84, Math.max(10, window.innerHeight - 1))
      );
      const isDark = Boolean(
        el?.closest(
          ".on-dark-section, .simulation-section, #practice, .closing-section, [data-header-dark='true']"
        )
      );
      setIsOnDark(isDark);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinkClass = `text-sm font-semibold transition-colors duration-200 ${
    isOnDark
      ? "text-slate-200 hover:text-white"
      : "text-slate-600 hover:text-brand-500"
  }`;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 h-[84px] transition-all duration-300 ${
        isOnDark
          ? "border-b border-white/15 bg-[#283157]/95 text-white shadow-lg shadow-[#283157]/20 backdrop-blur-md"
          : "border-b border-border/80 bg-dominant/85 text-slate-800 shadow-sm backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 md:px-10">
        {/* Brand Logo & Wordmark */}
        <div className="flex items-center gap-6 lg:gap-10">
          <Link href="/" className="group flex items-center gap-2.5">
            <BrandLogo
              size="md"
              variant="dark"
              className="rounded-xl shadow-md transition-transform duration-200 group-hover:scale-105 ring-1 ring-white/10"
              priority
            />
            <span
              className={`text-xl font-extrabold tracking-[-0.06em] transition-colors duration-200 ${
                isOnDark ? "text-white" : "text-slate-900"
              }`}
            >
              belajar<span className="text-brand-500">.skuy</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-7 md:flex" aria-label="Navigasi utama">
            <Link href="/" className={navLinkClass}>
              {t.nav.home ?? "Home"}
            </Link>

            {user ? (
              <Link href="/portal" className={navLinkClass}>
                {t.nav.portal}
              </Link>
            ) : (
              <a href={`${anchorBase}#features`} className={navLinkClass}>
                {t.nav.features}
              </a>
            )}

            <a href={`${anchorBase}#practice`} className={navLinkClass}>
              {lang === "id" ? "Simulasi" : "Practice"}
            </a>

            <a href={`${anchorBase}#how`} className={navLinkClass}>
              {t.nav.how}
            </a>

            <Link href="/pricing" className={navLinkClass}>
              {t.nav.pricing}
            </Link>
          </nav>
        </div>

        {/* Right Section Controls: Language, and User / Auth Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle lang={lang} />

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
            <div className="hidden items-center gap-3 sm:flex">
              <Link
                href="/login"
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  isOnDark
                    ? "text-slate-200 hover:text-white"
                    : "text-slate-700 hover:text-brand-500"
                }`}
              >
                {t.nav.login}
              </Link>
              <Link
                href="/register"
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
                  isOnDark
                    ? "bg-white text-[#283157] hover:bg-slate-100"
                    : "bg-brand-500 text-white shadow-brand-500/25 hover:bg-brand-600"
                }`}
              >
                <span>{t.nav.register}</span>
                <i className="bi bi-arrow-up-right text-xs"></i>
              </Link>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Menu navigasi"
            aria-expanded={mobileMenuOpen}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition active:scale-95 md:hidden ${
              isOnDark
                ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                : "border-border bg-surface text-slate-700 hover:bg-surface-2"
            }`}
          >
            <i className={`bi ${mobileMenuOpen ? "bi-x-lg" : "bi-list"} text-lg`}></i>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="absolute inset-x-0 top-full border-b border-border bg-surface/98 px-5 py-5 shadow-2xl backdrop-blur-md md:hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex flex-col gap-1.5">
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
              href={`${anchorBase}#practice`}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-surface-2 hover:text-brand-500"
            >
              <i className="bi bi-camera-video text-base text-slate-400"></i>
              {lang === "id" ? "Simulasi" : "Practice"}
            </a>

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
              <div className="mt-3 flex flex-col gap-2.5 border-t border-border pt-4">
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
    </header>
  );
}
