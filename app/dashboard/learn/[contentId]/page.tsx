import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import LearnRoom, {
  type AttemptRow,
  type ContentRow,
  type QuizRow,
} from "@/components/LearnRoom";
import ChatWidget from "@/components/ChatWidget";
import { stripEssaySecrets, stripExamSecrets } from "@/lib/quiz";
import { computeChapterStates, collectCompletedContentIds } from "@/lib/chapterState";
import type { DrawerChapter } from "@/components/LearningPathDrawer";
import { getSessionUser } from "@/lib/session";
import { getUserLimits } from "@/lib/plans";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const { contentId } = await params;
  if (!supabaseConfigured) notFound();

  // Fitur CD — batas paket untuk mengunci tombol jawab-suara. Hanya tampilan;
  // penolakan sesungguhnya tetap di Express (`assertFeature`).
  const sessionUser = await getSessionUser();
  const limits = await getUserLimits(sessionUser?.planCode ?? "free");
  const isFreePlan = !sessionUser?.planCode || sessionUser.planCode === "free";
  const highLevelLocked = isFreePlan;

  const supabase = await createClient();
  const { data: content } = await supabase
    .from("contents")
    .select(
      "id, title, chapter_number, body, youtube_url, image_url, module_id, source_reference_text, source_pages, modules(id, title, total_chapters, source_type, source_file_path, source_file_name)"
    )
    .eq("id", contentId)
    .single();
  if (!content) notFound();

  const mod = content.modules as unknown as {
    id: string;
    title: string;
    total_chapters: number;
    source_type?: string;
    source_file_path?: string;
    source_file_name?: string;
  };

  // Fitur U — query ini saling independen (semuanya cuma butuh `content` yang sudah didapat),
  // jadi dijalankan paralel. `attempts` bab ini TIDAK ikut karena butuh `quiz.id` (dependen).
  // Fitur Y/Z — `siblings` kini ikut membawa `body`, plus 2 query baru (progres & attempt SEMUA
  // bab) untuk menghitung status kunci/buka yang sama persis dengan halaman course.
  const [
    { data: siblings },
    { data: quiz },
    { data: progressRows },
    { data: chatSession },
    { data: allAttempts },
  ] = await Promise.all([
    supabase
      .from("contents")
      .select("id, chapter_number, title, status:body->status")
      .eq("module_id", content.module_id)
      .order("chapter_number"),
    supabase
      .from("quizzes")
      .select("id, questions")
      .eq("content_id", contentId)
      .limit(1)
      .maybeSingle(),
    // RLS membatasi ke baris milik user sendiri (pola sama seperti halaman course)
    supabase.from("content_progress").select("content_id, current_step, completed_at"),
    supabase
      .from("chatbot_sessions")
      .select("counter_messages, history")
      .eq("content_id", contentId)
      .maybeSingle(),
    supabase.from("quiz_attempts").select("score, quizzes(content_id)"),
  ]);

  const siblingRows = (siblings ?? []) as {
    id: string;
    chapter_number: number;
    title: string;
    status?: string | null;
  }[];

  // Bab "selesai": completed_at terisi, ATAU fallback lulus kuis (data lama pra-Fitur K) —
  // helper yang sama dipakai halaman course & proxy generate.
  const completedSet = collectCompletedContentIds(progressRows, allAttempts);

  // Fitur Y/Z — status tiap bab, dihitung dengan helper yang sama dengan halaman course.
  const states = computeChapterStates(
    siblingRows.map((s) => ({
      body: s.status === "pending" ? { status: "pending" } : {},
      completed: completedSet.has(s.id),
    }))
  );
  const drawerChapters: DrawerChapter[] = siblingRows.map((s, i) => ({
    id: s.id,
    number: s.chapter_number,
    title: s.title,
    state: states[i],
  }));

  // Navigasi prev/next antar bab (Track 13: Bebas navigasi ke bab mana pun)
  const idx = siblingRows.findIndex((s) => s.id === content.id);
  const prev = idx > 0 ? siblingRows[idx - 1] : null;
  const next = idx >= 0 && idx < siblingRows.length - 1 ? siblingRows[idx + 1] : null;

  // Dependen ke `quiz` — sengaja di luar Promise.all di atas.
  // Task 14D-LR: Batasi 10 attempts terbaru pada initial load untuk memangkas megabytes payload
  let attempts: AttemptRow[] = [];
  if (quiz) {
    const { data } = await supabase
      .from("quiz_attempts")
      .select("id, score, answers, submitted_at")
      .eq("quiz_id", quiz.id)
      .order("submitted_at", { ascending: false })
      .limit(10);
    attempts = (data ?? []) as AttemptRow[];
  }

  // Task 15D-QS (F19 & F24) — Hapus kunci PG & pembahasan pada fase ujian jika belum ada attempt
  const hasAttempted = attempts.length > 0;
  const safeQuiz = quiz
    ? {
        ...quiz,
        questions: hasAttempted
          ? stripEssaySecrets(quiz.questions as Record<string, unknown>[])
          : stripExamSecrets(quiz.questions as Record<string, unknown>[]),
      }
    : null;

  // Progres materi bertahap bab ini (Fitur E) — resume dari step terakhir
  const initialStep =
    ((progressRows ?? []) as { content_id: string; current_step: number }[]).find(
      (p) => p.content_id === contentId
    )?.current_step ?? 0;

  // Sesi chatbot bab ini (RLS: hanya milik user sendiri)
  // Task 14D-LR: Batasi 10 histori chat terbaru agar tidak membebani initial server render
  const chatRemaining = Math.max(0, 5 - (chatSession?.counter_messages ?? 0));
  const chatHistory = (Array.isArray(chatSession?.history) ? chatSession!.history : [])
    .slice(-10) as {
      role: "user" | "assistant";
      content: string;
    }[];
  const generated =
    content.body != null &&
    (content.body as { status?: string }).status !== "pending";

  return (
    <main className="mx-auto max-w-6xl p-8">
      <nav className="mb-4 text-xs text-slate-400">
        <Link href="/dashboard" className="hover:text-brand-500">
          Dashboard
        </Link>{" "}
        /{" "}
        <Link href={`/dashboard/courses/${mod.id}`} className="hover:text-brand-500">
          {mod.title}
        </Link>{" "}
        / <span className="font-medium text-brand-500">Bab {content.chapter_number}</span>
      </nav>

      <LearnRoom
        content={content as unknown as ContentRow}
        quiz={safeQuiz as QuizRow | null}
        attempts={attempts}
        initialStep={initialStep}
        courseHref={`/dashboard/courses/${mod.id}`}
        chapters={drawerChapters}
        voiceLocked={!limits.voicePractice}
        highLevelLocked={highLevelLocked}
      />

      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5 text-xs">
        {prev ? (
          <Link
            href={`/dashboard/learn/${prev.id}`}
            className="font-medium text-slate-500 hover:text-brand-500"
          >
            ← Bab {prev.chapter_number}: {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {/* Track 13 — Bebas navigasi ke bab berikutnya tanpa status terkunci */}
        {next ? (
          <Link
            href={`/dashboard/learn/${next.id}`}
            className="font-medium text-slate-500 hover:text-brand-500"
          >
            Bab {next.chapter_number}: {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </div>

      {generated && (
        <ChatWidget
          contentId={content.id}
          chapterTitle={content.title}
          initialRemaining={chatRemaining}
          initialMessages={chatHistory.map(({ role, content: c }) => ({
            role,
            content: c,
          }))}
        />
      )}
    </main>
  );
}
