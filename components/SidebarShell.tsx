"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

interface SidebarContextType {
  isCollapsed: boolean;
  toggle: () => void;
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  toggle: () => {},
  closeMobile: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

/** Kelas item nav aktif/nonaktif — konsisten & mendukung mode ringkas (collapsed). */
export function sidebarItemClass(active: boolean, isCollapsed = false) {
  return `flex items-center ${
    isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
  } rounded-md text-sm font-medium transition ${
    active
      ? "bg-sidebar-active text-sidebar-fg shadow-sm"
      : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
  }`;
}

export default function SidebarShell({
  username,
  planCode = "free",
  ctaHref,
  ctaLabel,
  children,
}: {
  username: string;
  planCode?: string;
  ctaHref: string;
  ctaLabel: string;
  /** Isi <nav> — beda per dashboard. */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const berbayar = planCode !== "free";
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Mode HP (< 768px): default tertutup saat awal muat agar konten bersih
    if (window.innerWidth < 768) {
      setIsCollapsed(true);
    } else {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    }
  }, []);

  // Otomatis tutup drawer di mobile saat user berpindah halaman
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsCollapsed(true);
    }
  }, [pathname]);

  // Dukungan tombol Escape untuk menutup drawer di mobile
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isCollapsed && window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCollapsed]);

  function toggle() {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (window.innerWidth >= 768) {
        localStorage.setItem("sidebar_collapsed", String(next));
      }
      return next;
    });
  }

  function closeMobile() {
    if (window.innerWidth < 768) {
      setIsCollapsed(true);
    }
  }

  async function signOut() {
    if (supabaseConfigured) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle, closeMobile }}>
      {/* Backdrop overlay di layar HP ketika sidebar terbuka (menutupi konten di belakang) */}
      {!isCollapsed && (
        <div
          onClick={closeMobile}
          className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-xs transition-opacity duration-300 md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Tombol Tampilkan Sidebar ketika sidebar sedang disembunyikan */}
      {isCollapsed && (
        <button
          onClick={toggle}
          title="Tampilkan Sidebar"
          className="fixed top-3.5 left-4 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-border bg-secondary-fixed text-sidebar-fg shadow-md transition hover:bg-sidebar-hover active:scale-95"
        >
          <i className="bi bi-layout-sidebar-inset text-base"></i>
        </button>
      )}

      {/* 
        Mode HP (< md): Drawer overlay fixed di atas konten (z-50), tidak mengubah ukuran konten 
        Mode Desktop (>= md): Alur flex normal (in-flow), collapsible w-60 / w-0
      */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-sidebar-border bg-secondary-fixed transition-all duration-300 ease-in-out md:relative md:inset-auto md:z-auto md:shadow-none md:shrink-0 ${
          isCollapsed
            ? "-translate-x-full opacity-0 pointer-events-none md:w-0 md:p-0 md:overflow-hidden md:opacity-0 md:border-r-0 md:translate-x-0"
            : "w-72 max-w-[85vw] px-4 py-6 opacity-100 border-r shadow-2xl translate-x-0 md:w-60 md:px-4 md:py-6"
        }`}
      >
        {/* Tombol Sembunyikan Sidebar */}
        <button
          onClick={toggle}
          title="Sembunyikan Sidebar"
          className="absolute top-4 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-sidebar-border bg-surface-1 text-sidebar-muted transition hover:bg-sidebar-hover hover:text-sidebar-fg shadow-sm"
        >
          <i className="bi bi-chevron-left text-xs"></i>
        </button>

        {/* Header Logo & Backlink ke Landing Page */}
        <div className="mb-6 mt-2 flex flex-col items-center justify-center text-center gap-2">
          <Link
            href="/"
            onClick={closeMobile}
            title="Kembali ke Landing Page"
            className="group flex flex-col items-center justify-center transition hover:opacity-90"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-fixed text-2xl font-bold text-secondary-fixed transition-transform duration-200 shadow-sm group-hover:scale-105">
              <i className="bi bi-book text-xl"></i>
            </div>
            <div className="mt-1.5">
              <p className="text-sm font-bold leading-tight text-sidebar-fg">
                belajar<span className="text-sidebar-dot">.skuy</span>
              </p>
            </div>
          </Link>

          {/* Portal Link */}
          <Link
            href="/portal"
            onClick={closeMobile}
            className="mt-1 flex items-center gap-1 text-[11px] font-medium text-sidebar-muted transition hover:text-sidebar-fg"
          >
            <i className="bi bi-arrow-left-right"></i>
            Portal
          </Link>
        </div>

        {/* Isi Navigasi: tutup otomatis saat link diklik pada mode mobile */}
        <nav
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("a")) {
              closeMobile();
            }
          }}
          className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden"
        >
          {children}
        </nav>

        {/* Footer Akun & CTA */}
        <div className="space-y-2 border-t border-sidebar-border pt-3">
          {berbayar ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold capitalize text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <i className="bi bi-patch-check-fill text-emerald-500"></i>
              Paket {planCode}
            </div>
          ) : (
            <Link
              href="/pricing"
              onClick={closeMobile}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-dot/40 px-3 py-2 text-xs font-semibold text-sidebar-dot transition hover:bg-sidebar-hover"
            >
              <i className="bi bi-stars"></i>
              Upgrade Premium
            </Link>
          )}

          <Link
            href={ctaHref}
            onClick={closeMobile}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent-fixed px-3 py-2.5 text-sm font-semibold text-secondary-fixed shadow-md transition hover:opacity-90 active:scale-[0.98]"
          >
            {ctaLabel}
          </Link>

          <div className="space-y-1">
            <p className="truncate px-3 text-xs font-medium text-sidebar-muted">@{username}</p>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-rose-500 transition hover:bg-rose-500/10"
            >
              ⏻ Sign Out
            </button>
          </div>
        </div>
      </aside>
    </SidebarContext.Provider>
  );
}
