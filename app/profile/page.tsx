import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";
import { LANG_COOKIE, getDict, normalizeLang } from "@/lib/i18n";
import EditProfileForm from "@/components/EditProfileForm";
import SubscriptionDetailsCard from "@/components/SubscriptionDetailsCard";
import { getUserSubscriptionDetails } from "@/lib/subscriptions";

export const metadata: Metadata = {
  title: "Edit Profil — belajar.skuy",
};

/**
 * Fitur EF (planning-update-12) — dipindah dari `app/dashboard/profile/page.tsx`.
 *
 * Ditambahkan kartu Detail Paket & Pembayaran (planning-update-13) di bawah form profil
 * agar user bisa mengelola langganan dan membatalkan paket langsung dari sini.
 */
export default async function ProfilePage() {
  const store = await cookies();
  const lang = normalizeLang(store.get(LANG_COOKIE)?.value);
  const t = getDict(lang);

  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!supabaseConfigured) redirect("/portal");
  const supabase = await createClient();
  const [{ data: profile }, subDetails] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, full_name, avatar_url, tanggal_lahir, pendidikan_saat_ini, jurusan, institusi, level_bicara, tujuan_user")
      .eq("id", user.id)
      .single(),
    getUserSubscriptionDetails(user.id),
  ]);

  return (
    <div className="min-h-screen bg-dominant text-slate-800">
      <SiteHeader lang={lang} t={t} anchorBase="/" user={user} />

      <main className="mx-auto max-w-3xl space-y-8 px-5 pb-24 pt-32 md:px-10">
        <div>
          <p className="mb-2 text-sm">
            <Link href="/portal" className="font-semibold text-brand-500 hover:underline">
              ↩ Portal
            </Link>
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Edit Profil</h1>
          <p className="mt-1 text-sm text-slate-500">Perbarui identitas, informasi akademik, dan preferensi belajarmu.</p>

          <div className="mt-6">
            <EditProfileForm
              userId={user.id}
              initialFullName={profile?.full_name ?? ""}
              initialUsername={profile?.username ?? ""}
              initialAvatarUrl={profile?.avatar_url ?? ""}
              initialTanggalLahir={profile?.tanggal_lahir ?? ""}
              initialPendidikan={profile?.pendidikan_saat_ini ?? ""}
              initialJurusan={profile?.jurusan ?? ""}
              initialInstitusi={profile?.institusi ?? ""}
              initialLevelBicara={profile?.level_bicara ?? "pemula"}
              initialTujuanUser={profile?.tujuan_user ?? "keduanya"}
            />
          </div>
        </div>

        {/* ── Detail Paket & Pembayaran (planning-update-13) ──────── */}
        <section>
          <SubscriptionDetailsCard
            initialDetails={subDetails}
            t={t}
            lang={lang}
          />
        </section>
      </main>
    </div>
  );
}
