import { cookies } from "next/headers";
import NewCourseCard from "@/components/NewCourseCard";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { LANG_COOKIE, getDict, normalizeLang } from "@/lib/i18n";

// Halaman khusus generate materi (dipindah dari Dashboard ke item sidebar sendiri).
export default async function GenerateCoursePage() {
  const t = getDict(normalizeLang((await cookies()).get(LANG_COOKIE)?.value)).dashboard.generate;
  // Fitur V — judul course yang sudah dimiliki, dipakai menyaring chip rekomendasi statis
  // (supaya tidak menyarankan topik yang sudah punya). RLS: hanya course milik user sendiri.
  let ownedTitles: string[] = [];
  if (supabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("modules")
      .select("title")
      .gt("total_chapters", 0); // abaikan modul pembungkus kuis kustom (Modul 10/Fitur N)
    ownedTitles = (data ?? []).map((m) => m.title as string).filter(Boolean);
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">{t.subtitle}</p>

      <div className="mt-6">
        <NewCourseCard ownedTitles={ownedTitles} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm bg-white p-5 shadow-card">
          <p className="text-sm font-bold"><i className="bi bi-pencil-square"></i> {t.quizCardTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{t.quizCardBody}</p>
          <a
            href="/dashboard/quizzes"
            className="mt-3 inline-block rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {t.quizCardCta}
          </a>
        </div>
        <div className="rounded-sm bg-white p-5 shadow-card">
          <p className="text-sm font-bold"><i className="bi bi-book"></i> {t.libraryCardTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{t.libraryCardBody}</p>
          <a
            href="/dashboard/library"
            className="mt-3 inline-block rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {t.libraryCardCta}
          </a>
        </div>
      </div>
    </main>
  );
}
