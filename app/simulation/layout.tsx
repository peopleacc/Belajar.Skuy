import { cookies } from "next/headers";
import SimulationSidebar from "@/components/SimulationSidebar";
import Topbar from "@/components/Topbar";
import { getSessionUser } from "@/lib/session";
import { LANG_COOKIE, normalizeLang } from "@/lib/i18n";

// Fitur CE (planning-update-9) — kerangka dashboard untuk /simulation/*, pola
// PERSIS app/dashboard/layout.tsx (Topbar sudah generik, dipakai apa adanya).
//
// Pengecekan login TETAP dilakukan per-halaman (bukan di sini) — layout ini
// murni urusan tampilan, sama seperti dashboard/layout.tsx tidak menggantikan
// pengecekan auth di tiap page.tsx-nya.
export default async function SimulationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);

  const username = user?.username ?? "tamu";
  const fullName = user?.fullName ?? "";
  const avatarUrl = user?.avatarUrl ?? null;
  const planCode = user?.planCode ?? "free";

  return (
    <div className="flex h-screen overflow-hidden bg-dominant">
      <SimulationSidebar username={username} planCode={planCode} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar fullName={fullName} username={username} avatarUrl={avatarUrl} lang={lang} />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
