"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SidebarShell, { sidebarItemClass, useSidebar } from "@/components/SidebarShell";

interface SimulationChildItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
}

// Hanya mode simulasi aktif yang berada di dalam dropdown Simulation
const SIMULATION_CHILDREN: SimulationChildItem[] = [
  {
    href: "/simulation/new",
    label: "Presentasi",
    icon: "bi-easel2-fill",
    badge: "Slide PDF",
  },
  {
    href: "/simulation/interview",
    label: "Interview",
    icon: "bi-briefcase-fill",
    badge: "HR",
  },
  {
    href: "/simulation/wawancara",
    label: "Wawancara",
    icon: "bi-mic-fill",
    badge: "Kustom",
  },
];

function SimulationNavItems() {
  const pathname = usePathname();
  const { closeMobile } = useSidebar();

  const isDashboard = pathname === "/simulation";
  const isResults = pathname === "/simulation/results";
  const isSimulationChildActive = SIMULATION_CHILDREN.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + "/")
  );

  // Dropdown otomatis terbuka jika pengguna sedang berada di salah satu halaman anak simulasi
  const [simulationOpen, setSimulationOpen] = useState<boolean>(isSimulationChildActive || true);

  return (
    <>
      {/* 1. Dashboard Utama (Top Level) */}
      <Link
        href="/simulation"
        className={sidebarItemClass(isDashboard)}
        onClick={closeMobile}
      >
        <span className="text-base">
          <i className="bi bi-clipboard2-data-fill"></i>
        </span>
        Dashboard
      </Link>

      {/* 2. Grup Dropdown 'Simulation' (Task 2E-SG: Presentasi, Interview, Wawancara) */}
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setSimulationOpen((prev) => !prev)}
          className={`w-full ${sidebarItemClass(
            isSimulationChildActive && !simulationOpen
          )} flex items-center justify-between text-left`}
        >
          <div className="flex items-center gap-3">
            <span className="text-base text-brand-500">
              <i className="bi bi-camera-video-fill"></i>
            </span>
            <span className="font-semibold">Simulation</span>
          </div>
          <span
            className={`ml-auto text-[10px] text-slate-400 transition-transform duration-200 ${
              simulationOpen ? "rotate-90 text-brand-600" : ""
            }`}
          >
            ▸
          </span>
        </button>

        {/* Submenu Dropdown Anak di Bawah Grup Simulation */}
        {simulationOpen && (
          <div className="ml-3 space-y-1 border-l border-sidebar-border pl-3">
            {SIMULATION_CHILDREN.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobile}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition ${
                    active
                      ? "bg-sidebar-active text-sidebar-fg shadow-xs font-semibold"
                      : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-sm">
                      <i className={`bi ${item.icon}`}></i>
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Rekap Hasil (Top Level — Di Luar Dropdown Sesuai Permintaan) */}
      <Link
        href="/simulation/results"
        className={sidebarItemClass(isResults)}
        onClick={closeMobile}
      >
        <span className="text-base">
          <i className="bi bi-table"></i>
        </span>
        Rekap Hasil
      </Link>
    </>
  );
}

export default function SimulationSidebar({
  username,
  planCode = "free",
}: {
  username: string;
  planCode?: string;
}) {
  return (
    <SidebarShell
      username={username}
      planCode={planCode}
      ctaHref="/simulation"
      ctaLabel="+ Sesi Baru"
    >
      <SimulationNavItems />
    </SidebarShell>
  );
}
