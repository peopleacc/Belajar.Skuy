import { cookies } from "next/headers";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { getSessionUser } from "@/lib/session";
import { LANG_COOKIE, normalizeLang } from "@/lib/i18n";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Fitur CA — profil & paket lewat helper bersama; paket kini dari tabel
  // `subscriptions` (dengan masa berlaku), bukan `profiles.subscription_status`.
  const user = await getSessionUser();
  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);

  const username = user?.username ?? "tamu";
  const fullName = user?.fullName ?? "";
  const avatarUrl = user?.avatarUrl ?? null;
  const planCode = user?.planCode ?? "free";

  return (
    <div className="flex h-screen overflow-hidden bg-dominant">
      <Sidebar username={username} planCode={planCode} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar fullName={fullName} username={username} avatarUrl={avatarUrl} lang={lang} />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
