"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

/**
 * Fitur CE (planning-update-9) — kerangka sidebar yang DIPAKAI BERSAMA dashboard
 * course (`Sidebar.tsx`) dan dashboard simulasi (`SimulationSidebar.tsx`).
 *
 * Diekstrak dari `Sidebar.tsx` supaya logo, footer paket/akun, dan sign-out tidak
 * disalin jadi dua salinan yang lama-lama diam-diam berbeda — persis masalah yang
 * berulang kali muncul di project ini (rebalanceQuizTypes vs sanitizeQuizTypes,
 * dua mesin rekam sebelum disatukan `useSessionRecorder`).
 *
 * Yang BUKAN tanggung jawab shell ini: isi `<nav>` (tiap dashboard beda struktur,
 * course punya dropdown, simulasi tidak) dan tujuan tombol CTA — keduanya
 * diserahkan lewat props/children ke pemanggil.
 */

/** Kelas item nav aktif/nonaktif — diekspor supaya kedua sidebar konsisten
 *  pixel-perfect, bukan menyalin string kelas Tailwind dua kali. */
export function sidebarItemClass(active: boolean) {
  return `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
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
  // Dari tabel `subscriptions` (migration 006), sudah memperhitungkan masa berlaku.
  planCode?: string;
  ctaHref: string;
  ctaLabel: string;
  /** Isi <nav> — beda per dashboard (course punya dropdown, simulasi tidak). */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const berbayar = planCode !== "free";

  async function signOut() {
    if (supabaseConfigured) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-secondary-fixed border-r border-sidebar-border px-4 py-6 transition-colors duration-200">
      <div className="mb-8 flex flex-col items-center justify-center text-center gap-2 px-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent-fixed text-3xl font-bold text-secondary-fixed transition-colors duration-200 shadow-sm">
          <i className="bi bi-book text-2xl"></i>
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-sidebar-fg">
            belajar<span className="text-sidebar-dot">.skuy</span>
          </p>
        </div>
        {/* Fitur CE — sekarang ada DUA dashboard penuh (course & simulasi); tanpa
            ini user cuma bisa balik pakai tombol back browser. */}
        <Link
          href="/portal"
          className="mt-1 flex items-center gap-1 text-[11px] font-medium text-sidebar-muted transition hover:text-sidebar-fg"
        >
          <i className="bi bi-arrow-left-right"></i>
          Portal
        </Link>
      </div>

      <nav className="flex-1 space-y-1">{children}</nav>

      <div className="space-y-3 border-t border-sidebar-border pt-4">
        {/* Paket akun. Berbayar → tampilkan status; gratis → ajakan upgrade ke /pricing. */}
        {berbayar ? (
          <div className="flex w-full items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold capitalize text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <i className="bi bi-patch-check-fill text-emerald-500"></i>
            Paket {planCode}
          </div>
        ) : (
          <Link
            href="/pricing"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-dot/40 px-3 py-2.5 text-sm font-semibold text-sidebar-dot transition hover:bg-sidebar-hover"
          >
            <i className="bi bi-stars"></i>
            Upgrade Premium
          </Link>
        )}

        <Link
          href={ctaHref}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-accent-fixed px-3 py-2.5 text-sm font-semibold text-secondary-fixed shadow-md transition hover:opacity-90 active:scale-[0.98]"
        >
          {ctaLabel}
        </Link>
        <div className="space-y-1">
          <p className="truncate px-3 text-xs font-medium text-sidebar-muted">@{username}</p>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-rose-500 transition hover:bg-rose-500/10"
          >
            ⏻ Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
