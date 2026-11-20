"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SidebarShell, { sidebarItemClass, useSidebar } from "@/components/SidebarShell";

interface CourseChildItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
}

// Generate Course + My Course + Study Library digabung jadi grup "Course" (dropdown).
// Diselaraskan format & ukurannya dengan standar SimulationSidebar (Task 2E-SG & 3E-CD).
const COURSE_CHILDREN: CourseChildItem[] = [
  {
    href: "/dashboard/generate",
    label: "Generate Course",
    icon: "bi-lightning-charge-fill",
    badge: "AI",
  },
  {
    href: "/dashboard/my-course",
    label: "My Course",
    icon: "bi-journals",
  },
  {
    href: "/dashboard/library",
    label: "Study Library",
    icon: "bi-book-half",
  },
];

function CourseNavItems() {
  const pathname = usePathname();
  const { closeMobile } = useSidebar();

  const isDashboard = pathname === "/dashboard";
  const isQuizzes =
    pathname === "/dashboard/quizzes" || pathname.startsWith("/dashboard/quizzes/");
  const isCourseChildActive = COURSE_CHILDREN.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + "/")
  );

  // Dropdown otomatis langsung terbuka secara default saat pertama kali masuk (open by default)
  const [courseOpen, setCourseOpen] = useState<boolean>(isCourseChildActive || true);

  return (
    <>
      {/* 1. Dashboard Utama */}
      <Link
        href="/dashboard"
        className={sidebarItemClass(isDashboard)}
        onClick={closeMobile}
      >
        <span className="text-base">
          <i className="bi bi-clipboard2-data-fill"></i>
        </span>
        Dashboard
      </Link>

      {/* 2. Grup Dropdown 'Course' (Ukuran, spacing & arrow rotasi serasi dengan Simulation 2E-SG) */}
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setCourseOpen((prev) => !prev)}
          className={`w-full ${sidebarItemClass(
            isCourseChildActive && !courseOpen
          )} flex items-center justify-between text-left`}
        >
          <div className="flex items-center gap-3">
            <span className="text-base text-brand-500">
              <i className="bi bi-bookmarks-fill"></i>
            </span>
            <span className="font-semibold">Course</span>
          </div>
          <span
            className={`ml-auto text-[10px] text-slate-400 transition-transform duration-200 ${
              courseOpen ? "rotate-90 text-brand-600" : ""
            }`}
          >
            ▸
          </span>
        </button>

        {/* Submenu Dropdown Anak di Bawah Grup Course */}
        {courseOpen && (
          <div className="ml-3 space-y-1 border-l border-sidebar-border pl-3">
            {COURSE_CHILDREN.map((item) => {
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

      {/* 3. Quizzes */}
      <Link
        href="/dashboard/quizzes"
        className={sidebarItemClass(isQuizzes)}
        onClick={closeMobile}
      >
        <span className="text-base">
          <i className="bi bi-pencil-square"></i>
        </span>
        Quizzes
      </Link>
    </>
  );
}

export default function Sidebar({
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
      ctaHref="/dashboard/generate"
      ctaLabel="+ New Course"
    >
      <CourseNavItems />
    </SidebarShell>
  );
}
