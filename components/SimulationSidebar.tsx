"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SidebarShell, { sidebarItemClass, useSidebar } from "@/components/SidebarShell";

function SimulationNavItems() {
  const pathname = usePathname();

  const isDashboard = pathname === "/simulation";
  const isNew = pathname === "/simulation/new";
  const isInterview = pathname === "/simulation/interview" || pathname.startsWith("/simulation/run/");
  const isWawancara = pathname === "/simulation/wawancara";
  const isResults = pathname === "/simulation/results";

  const items = [
    { href: "/simulation", label: "Dashboard", active: isDashboard, icon: "bi-clipboard2-data-fill" },
    { href: "/simulation/new", label: "Presentasi", active: isNew, icon: "bi-easel2-fill" },
    { href: "/simulation/interview", label: "Interview", active: isInterview, icon: "bi-briefcase-fill" },
    { href: "/simulation/wawancara", label: "Wawancara", active: isWawancara, icon: "bi-mic-fill" },
    { href: "/simulation/results", label: "Rekap Hasil", active: isResults, icon: "bi-table" },
  ];

  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={sidebarItemClass(item.active)}
        >
          <span className="text-base">
            <i className={`bi ${item.icon}`}></i>
          </span>
          {item.label}
        </Link>
      ))}
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
    <SidebarShell username={username} planCode={planCode} ctaHref="/simulation" ctaLabel="+ Sesi Baru">
      <SimulationNavItems />
    </SidebarShell>
  );
}
