"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

/**
 * Fitur BG — avatar + dropdown profil. Diangkat dari `Topbar.tsx` supaya dipakai
 * BERSAMA oleh navbar dashboard dan navbar publik (`SiteHeader`). Kalau dibuat dua
 * kali, perilaku sign out dan tampilan avatar cepat atau lambat akan berbeda sendiri.
 */
export default function UserMenu({
  fullName,
  username,
  avatarUrl,
  labels,
}: {
  fullName: string;
  username: string;
  avatarUrl: string | null;
  // Dibiarkan opsional supaya dashboard (belum di-i18n) tetap pakai teks bawaan.
  labels?: { portal: string; editProfile: string; signOut: string; noName: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const t = labels ?? {
    portal: "Portal",
    editProfile: "Edit Profil",
    signOut: "Sign Out",
    noName: "Tanpa nama",
  };

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function signOut() {
    if (supabaseConfigured) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  const initials = (fullName || username || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-xl border border-border bg-surface py-1.5 pl-1.5 pr-3 transition hover:bg-surface-2"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={fullName} className="h-7 w-7 rounded-lg object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white dark:text-slate-50">
            {initials}
          </span>
        )}
        <span className="hidden text-sm font-semibold text-slate-700 sm:block">
          {fullName || username}
        </span>
        <span className="text-[10px] text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-bold text-slate-800">{fullName || t.noName}</p>
            <p className="truncate text-xs text-slate-400">@{username}</p>
          </div>
          <Link
            href="/portal"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-surface-2"
          >
            <i className="bi bi-grid-1x2"></i> {t.portal}
          </Link>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-surface-2"
          >
            <i className="bi bi-pencil"></i> {t.editProfile}
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-rose-500 transition hover:bg-rose-500/10"
          >
            <i className="bi bi-power"></i> {t.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
