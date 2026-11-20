import Link from "next/link";
import { cookies } from "next/headers";
import CustomQuizForm, { type MaterialSource } from "@/components/CustomQuizForm";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";
import { getUserLimits } from "@/lib/plans";
import { LANG_COOKIE, getDict, normalizeLang } from "@/lib/i18n";

type QuizListRow = {
  id: string;
  created_at: string;
  questionCount: number;
  moduleTitle: string;
};

type ModuleWithContents = {
  id: string;
  title: string;
  contents: { id: string; chapter_number: number; title: string; status?: string | null }[] | null;
};

export default async function QuizzesPage() {
  const t = getDict(normalizeLang((await cookies()).get(LANG_COOKIE)?.value)).dashboard.quizzes;
  // Fitur CD — kunci pilihan soal jawab-suara kalau paket belum mencakupnya.
  const sessionUser = await getSessionUser();
  const limits = await getUserLimits(sessionUser?.planCode ?? "free");

  let quizzes: QuizListRow[] = [];
  let materialSources: MaterialSource[] = [];

  if (supabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("quizzes")
      .select("id, created_at, questions, modules(title)")
      .is("content_id", null) // kuis kustom saja (bukan kuis bab)
      .order("created_at", { ascending: false });

    // Task 14C-DS: Hitung agregat questionCount di server & cegah serialisasi soal mentah ke Flight payload
    quizzes = (data ?? []).map((q: any) => ({
      id: q.id,
      created_at: q.created_at,
      questionCount: Array.isArray(q.questions) ? q.questions.length : 0,
      moduleTitle: (q.modules?.title ?? "Kuis Kustom").replace(/^Kuis Kustom: /, ""),
    }));

    // Fitur N & Task 14C-DS — daftar course + bab yang SUDAH punya materi (tanpa unduh body mentah)
    const { data: courseRows } = await supabase
      .from("modules")
      .select("id, title, contents(id, chapter_number, title, status:body->status)")
      .order("created_at", { ascending: false });
    materialSources = ((courseRows ?? []) as unknown as ModuleWithContents[])
      .map((m) => ({
        moduleId: m.id,
        moduleTitle: m.title,
        chapters: (m.contents ?? [])
          .filter((c) => c.status !== "pending")
          .sort((a, b) => a.chapter_number - b.chapter_number)
          .map((c) => ({ id: c.id, number: c.chapter_number, title: c.title })),
      }))
      .filter((m) => m.chapters.length > 0);
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>

      <div className="mt-6">
        <CustomQuizForm materialSources={materialSources} voiceLocked={!limits.voicePractice} />
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-bold">{t.myCustom}</h2>
        {quizzes.length === 0 ? (
          <div className="rounded-sm border-2 border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl text-brand-500">
              <i className="bi bi-puzzle-fill"></i>
            </div>
            <p className="mt-2 font-semibold text-slate-700">{t.emptyTitle}</p>
            <p className="mt-1 text-sm text-slate-400">{t.emptyBody}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {quizzes.map((q) => (
              <Link
                key={q.id}
                href={`/dashboard/quizzes/${q.id}`}
                className="rounded-2xl bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <p className="font-bold">{q.moduleTitle}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {q.questionCount} {t.questionsUnit} ·{" "}
                  {new Date(q.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
