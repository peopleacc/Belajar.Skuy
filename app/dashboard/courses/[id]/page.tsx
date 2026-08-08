import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import CourseChapters, { type ChapterNode } from "@/components/CourseChapters";
import { computeChapterStates, collectCompletedContentIds } from "@/lib/chapterState";
import { getSessionUser } from "@/lib/session";
import { getUserLimits } from "@/lib/plans";

// Halaman course (detail modul): grid kartu bab (gaya mockup) + toggle Learning Path,
// plus rata-rata nilai per bab & daftar nilai tiap kuis yang dikerjakan.

type ContentRow = {
  id: string;
  chapter_number: number;
  title: string;
  body: Record<string, unknown> | null;
  image_url: string | null;
};

const PASS_SCORE = 70;

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  // Fitur CD — kunci pilihan soal jawab-suara kalau paket belum mencakupnya.
  const sessionUser = await getSessionUser();
  const limits = await getUserLimits(sessionUser?.planCode ?? "free");

  const { id } = await params;
  if (!supabaseConfigured) notFound();

  const supabase = await createClient();
  const { data: mod } = await supabase
    .from("modules")
    .select("id,title,description,total_chapters,image_url")
    .eq("id", id)
    .single();
  if (!mod) notFound();

  // Fitur U — 3 query ini saling independen (tak ada yang butuh hasil yang lain), jadi
  // dijalankan paralel. Sebelumnya berurutan → waktu tunggu = penjumlahan semua round-trip.
  const [{ data: contents }, { data: attempts }, { data: progressRows }] = await Promise.all([
    supabase
      .from("contents")
      .select("id,chapter_number,title,body,image_url")
      .eq("module_id", id)
      .order("chapter_number"),
    supabase.from("quiz_attempts").select("score, submitted_at, quizzes(content_id)"),
    supabase
      .from("content_progress")
      .select("content_id, current_step, total_steps, completed_at"),
  ]);

  const chapters = (contents ?? []) as ContentRow[];
  const contentIds = new Set(chapters.map((c) => c.id));
  const titleById = new Map(chapters.map((c) => [c.id, c]));

  // Attempts (nilai per kuis) milik user, difilter ke bab-bab modul ini
  const attemptsByContent = new Map<string, { score: number; at: string }[]>();
  for (const a of (attempts ?? []) as any[]) {
    const cId = a.quizzes?.content_id;
    if (cId && contentIds.has(cId)) {
      const arr = attemptsByContent.get(cId) ?? [];
      arr.push({ score: Number(a.score), at: a.submitted_at });
      attemptsByContent.set(cId, arr);
    }
  }

  // Progres dalam bab (content_progress) → persen "sedang dipelajari"
  const percentByContent = new Map<string, number>();
  for (const p of (progressRows ?? []) as any[]) {
    if (!contentIds.has(p.content_id)) continue;
    if (p.total_steps > 0) {
      percentByContent.set(p.content_id, Math.min(100, Math.round((p.current_step / p.total_steps) * 100)));
    }
  }

  // Status selesai (Fitur K) + fallback data lama — helper bersama dengan halaman learn &
  // proxy generate, supaya gate unlock tidak pernah beda antar halaman.
  const completedSet = collectCompletedContentIds(
    progressRows as { content_id: string; completed_at: string | null }[] | null,
    attempts as { score: number; quizzes: unknown }[] | null
  );

  // State berurutan + data kartu. Unlock berbasis STATUS SELESAI (completed_at), Fitur K.
  // Fitur Y/Z — perhitungannya dipindah ke helper bersama supaya halaman learn & proxy generate
  // memakai gate yang persis sama (dulu logic ini cuma ada di sini).
  const states = computeChapterStates(
    chapters.map((ch) => ({ body: ch.body, completed: completedSet.has(ch.id) }))
  );
  const nodes: ChapterNode[] = chapters.map((ch, i) => {
    const atts = attemptsByContent.get(ch.id) ?? [];
    const avgScore = atts.length
      ? Math.round(atts.reduce((s, x) => s + x.score, 0) / atts.length)
      : null;

    return {
      id: ch.id,
      chapter_number: ch.chapter_number,
      title: ch.title,
      state: states[i],
      percent: percentByContent.get(ch.id) ?? 0,
      avgScore,
      imageUrl: ch.image_url,
    };
  });

  const completedCount = nodes.filter((n) => n.state === "completed").length;
  const total = chapters.length;

  const nextNode = nodes.find((n) => n.state === "available" || n.state === "generate");
  const nextHref = nextNode ? `/dashboard/learn/${nextNode.id}` : null;
  const firstCompleted = nodes.find((n) => n.state === "completed");
  const reviewHref = firstCompleted ? `/dashboard/learn/${firstCompleted.id}` : null;

  // Bab yang punya nilai (untuk kartu rata-rata & daftar nilai per kuis)
  const scored = nodes.filter((n) => n.avgScore !== null);
  // Semua attempt (flat) diurutkan terbaru dulu
  const allAttempts = [...attemptsByContent.entries()]
    .flatMap(([cId, arr]) => arr.map((x) => ({ cId, ...x })))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <main className="mx-auto max-w-6xl p-8">
      {/* Hero banner: foto sampul course (Fitur I) kalau ada, else gradient (pola sama ChapterCard) */}
      <div className="relative overflow-hidden rounded-sm">
        {mod.image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mod.image_url}
              alt={mod.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/55 to-ink-900/35" />
          </>
        ) : (
          <span className="absolute inset-0 bg-gradient-to-br from-brand-600 to-secondary" />
        )}

        <div className="relative flex min-h-[180px] flex-col justify-end p-6 md:p-8">
          <nav className="mb-3 text-xs text-light-muted">
            <Link href="/dashboard" className="hover:text-light">
              Dashboard
            </Link>{" "}
            /{" "}
            <Link href="/dashboard/my-course" className="hover:text-light">
              My Course
            </Link>{" "}
            / <span className="font-medium text-light">{mod.title}</span>
          </nav>

          <h1 className="text-2xl font-bold tracking-tight text-light">{mod.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-light-muted">
            {mod.description ?? "Kurikulum hasil generate AI."}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <CourseChapters
          nodes={nodes}
          completedCount={completedCount}
          total={total}
          nextHref={nextHref}
          reviewHref={reviewHref}
          voiceLocked={!limits.voicePractice}
        />
      </div>

      {/* Rata-rata nilai per bab + Nilai tiap kuis */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-sm bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold">Rata-rata Nilai per Bab</h2>
          <p className="text-xs text-slate-400">Dari semua percobaan kuis tiap bab</p>
          <div className="mt-5 space-y-4">
            {scored.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada nilai — kerjakan kuis dulu.</p>
            ) : (
              scored.map((n) => (
                <div key={n.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="line-clamp-1 font-medium text-slate-600">
                      Bab {n.chapter_number}: {n.title}
                    </span>
                    <span className="font-bold text-slate-800">{n.avgScore}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-1.5 rounded-full ${
                        (n.avgScore ?? 0) >= PASS_SCORE ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${n.avgScore ?? 0}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-sm bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold">Nilai Tiap Kuis</h2>
          <p className="text-xs text-slate-400">Riwayat percobaan kuis di course ini</p>
          <div className="mt-5 space-y-2">
            {allAttempts.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada percobaan kuis.</p>
            ) : (
              allAttempts.slice(0, 12).map((a, i) => {
                const ch = titleById.get(a.cId);
                const passed = a.score >= PASS_SCORE;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium text-slate-700">
                        Bab {ch?.chapter_number}: {ch?.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(a.at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span
                      className={`ml-3 shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                        passed ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      }`}
                    >
                      {a.score}/100
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
