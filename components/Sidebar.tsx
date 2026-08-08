"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SidebarShell, { sidebarItemClass } from "@/components/SidebarShell";

// Generate Course + My Course + Study Library digabung jadi grup "Course" (dropdown).
const COURSE_CHILDREN = [
  { label: "Generate Course", href: "/dashboard/generate", icon: <i className="bi bi-lightning-charge-fill"></i> },
  { label: "My Course", href: "/dashboard/my-course", icon: <i className="bi bi-journals"></i> },
  { label: "Study Library", href: "/dashboard/library", icon: <i className="bi bi-book-half"></i> },
];

// Fitur CE (planning-update-9) — logo, footer paket/akun, & sign-out sekarang di
// `SidebarShell.tsx` (dipakai bersama `SimulationSidebar`). Yang tersisa di sini
// murni struktur nav course (dropdown) — TIDAK ADA perubahan perilaku dari versi
// sebelum diekstrak.
export default function Sidebar({
  username,
  planCode = "free",
}: {
  username: string;
  // Dari tabel `subscriptions` (migration 006), sudah memperhitungkan masa berlaku.
  planCode?: string;
}) {
  const pathname = usePathname();

  const courseActive = COURSE_CHILDREN.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + "/")
  );
  const [courseOpen, setCourseOpen] = useState(courseActive);

  return (
    <SidebarShell username={username} planCode={planCode} ctaHref="/dashboard/generate" ctaLabel="+ New Course">
      {/* Dashboard */}
      <Link href="/dashboard" className={sidebarItemClass(pathname === "/dashboard")}>
        <span className="text-base"><i className="bi bi-clipboard2-data-fill"></i></span>
        Dashboard
      </Link>

      {/* Course (dropdown) */}
      <button
        onClick={() => setCourseOpen((o) => !o)}
        className={`${sidebarItemClass(courseActive && !courseOpen)} w-full`}
      >
        <span className="text-base"><i className="bi bi-bookmarks-fill"></i></span>
        Course
        <span className={`ml-auto text-[10px] transition-transform ${courseOpen ? "rotate-90" : ""}`}>
          ▸
        </span>
      </button>
      {courseOpen && (
        <div className="ml-3 space-y-1 border-l border-sidebar-border pl-3">
          {COURSE_CHILDREN.map((c) => {
            const active = pathname === c.href || pathname.startsWith(c.href + "/");
            return (
              <Link
                key={c.href}
                href={c.href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition ${active
                  ? "bg-sidebar-active text-sidebar-fg"
                  : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
                  }`}
              >
                <span>{c.icon}</span>
                {c.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Quizzes */}
      <Link
        href="/dashboard/quizzes"
        className={sidebarItemClass(
          pathname === "/dashboard/quizzes" || pathname.startsWith("/dashboard/quizzes/")
        )}
      >
        <span className="text-base"><i className="bi bi-pencil-square"></i></span>
        Quizzes
      </Link>
    </SidebarShell>
  );
}
