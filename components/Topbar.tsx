"use client";

import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import UserMenu from "@/components/UserMenu";
import type { Lang } from "@/lib/i18n";

// Fitur C — navbar dashboard: toggle tema + avatar profil (pojok kanan).
// Fitur BG — bagian avatar/dropdown-nya kini di `UserMenu`, dipakai bersama navbar publik.
// Fitur DK — pemilih bahasa ikut di sini; sebelumnya cuma ada di `SiteHeader`
// (landing/portal/pricing), jadi begitu masuk dashboard bahasanya tidak bisa diganti.
export default function Topbar({
  fullName,
  username,
  avatarUrl,
  lang,
}: {
  fullName: string;
  username: string;
  avatarUrl: string | null;
  lang: Lang;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-3 border-b border-border bg-secondary-fixed/80 px-6 backdrop-blur transition-colors duration-200">
      <LanguageToggle lang={lang} />
      <ThemeToggle />
      <UserMenu fullName={fullName} username={username} avatarUrl={avatarUrl} />
    </header>
  );
}
