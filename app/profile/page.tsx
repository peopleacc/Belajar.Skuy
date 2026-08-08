import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";
import { LANG_COOKIE, getDict, normalizeLang } from "@/lib/i18n";
import EditProfileForm from "@/components/EditProfileForm";

export const metadata: Metadata = {
  title: "Edit Profil — belajar.skuy",
};

/**
 * Fitur EF (planning-update-12) — dipindah dari `app/dashboard/profile/page.tsx`.
 *
 * Sebelumnya halaman ini hidup di bawah `/dashboard/*`, jadi ikut memakai layout
 * & Sidebar Course (`app/dashboard/layout.tsx`) — padahal edit profil itu
 * lintas-mode (berlaku sama untuk user yang cuma pakai Simulasi). Sekarang
 * sejajar dengan `/portal` & `/pricing`, lepas dari payung dashboard course.
 *
 * Pengecekan login TETAP di sini sendiri (bukan cuma mengandalkan middleware) —
 * prinsip yang sama dipakai semua halaman privat lain di app ini.
 */
export default async function ProfilePage() {
  const store = await cookies();
  const lang = normalizeLang(store.get(LANG_COOKIE)?.value);
  const t = getDict(lang);

  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!supabaseConfigured) redirect("/portal");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-dominant text-slate-800">
      <SiteHeader lang={lang} t={t} anchorBase="/" user={user} />

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-32 md:px-10">
        <p className="mb-2 text-sm">
          <Link href="/portal" className="font-semibold text-brand-500 hover:underline">
            ↩ Portal
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Edit Profil</h1>
        <p className="mt-1 text-sm text-slate-500">Perbarui nama, username, dan avatarmu.</p>

        <div className="mt-6">
          <EditProfileForm
            userId={user.id}
            initialFullName={profile?.full_name ?? ""}
            initialUsername={profile?.username ?? ""}
            initialAvatarUrl={profile?.avatar_url ?? ""}
          />
        </div>
      </main>
    </div>
  );
}
