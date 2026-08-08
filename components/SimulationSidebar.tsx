"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SidebarShell, { sidebarItemClass } from "@/components/SidebarShell";

// Fitur CE (planning-update-9) — sidebar dashboard simulasi. Sengaja TIDAK
// menyalin Sidebar.tsx: memakai SidebarShell yang sama, cuma isi <nav> beda
// (di sini tanpa dropdown — cuma 3 tautan datar).
export default function SimulationSidebar({
  username,
  planCode = "free",
}: {
  username: string;
  planCode?: string;
}) {
  const pathname = usePathname();

  const isNew = pathname === "/simulation/new";
  const isInterview =
    pathname === "/simulation/interview" || pathname.startsWith("/simulation/run/");

  return (
    <SidebarShell username={username} planCode={planCode} ctaHref="/simulation" ctaLabel="+ Sesi Baru">
      <Link href="/simulation" className={sidebarItemClass(pathname === "/simulation")}>
        <span className="text-base"><i className="bi bi-clipboard2-data-fill"></i></span>
        Dashboard
      </Link>

      <Link href="/simulation/new" className={sidebarItemClass(isNew)}>
        <span className="text-base"><i className="bi bi-easel2-fill"></i></span>
        Presentasi
      </Link>

      <Link href="/simulation/interview" className={sidebarItemClass(isInterview)}>
        <span className="text-base"><i className="bi bi-chat-quote-fill"></i></span>
        Wawancara
      </Link>
    </SidebarShell>
  );
}
