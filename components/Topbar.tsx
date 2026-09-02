"use client";

import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import type { Lang } from "@/lib/i18n";

// Fitur C — navbar dashboard: toggle tema + avatar profil (pojok kanan).
// Fitur BG — bagian avatar/dropdown-nya kini di `UserMenu`, dipakai bersama navbar publik.
// Fitur DK / planning-update-14 — LanguageToggle dilepas dari Topbar dashboard
// (hanya ada di SiteHeader publik) agar tidak membingungkan user dengan bahasa materi AI.
export default function Topbar({
  fullName,
  username,
  avatarUrl,
}: {
  fullName: string;
  username: string;
  avatarUrl: string | null;
  lang?: Lang;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-3 border-b border-border bg-secondary-fixed/80 px-6 backdrop-blur transition-colors duration-200">
      <ThemeToggle />
      <UserMenu fullName={fullName} username={username} avatarUrl={avatarUrl} />
    </header>
  );
}
