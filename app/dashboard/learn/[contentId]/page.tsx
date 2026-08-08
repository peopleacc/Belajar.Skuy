import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import LearnRoom, {
  type AttemptRow,
  type ContentRow,
  type QuizRow,
} from "@/components/LearnRoom";
import ChatWidget from "@/components/ChatWidget";
import { stripEssaySecrets } from "@/lib/quiz";
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

  const supabase = await createClient();
  const { data: content } = await supabase
    .from("contents")
    .select(
      "id, title, chapter_number, body, youtube_url, image_url, module_id, modules(id, title, total_chapters)"
    )
    .eq("id", contentId)
    .single();
  if (!content) notFound();

  const mod = content.modules as unknown as {
    id: string;
    title: string;
    total_chapters: number;
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
      .select("id, chapter_number, title, body")
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
    body: Record<string, unknown> | null;
  }[];

  // Bab "selesai": completed_at terisi, ATAU fallback lulus kuis (data lama pra-Fitur K) —
  // helper yang sama dipakai halaman course & proxy generate.
  const completedSet = collectCompletedContentIds(progressRows, allAttempts);

  // Fitur Y/Z — status tiap bab, dihitung dengan helper yang sama dengan halaman course.
  const states = computeChapterStates(
    siblingRows.map((s) => ({ body: s.body, completed: completedSet.has(s.id) }))
  );
  const drawerChapters: DrawerChapter[] = siblingRows.map((s, i) => ({
    id: s.id,
    number: s.chapter_number,
    title: s.title,
    state: states[i],
  }));

  // Navigasi prev/next antar bab
  const idx = siblingRows.findIndex((s) => s.id === content.id);
  const prev = idx > 0 ? siblingRows[idx - 1] : null;
  const next = idx >= 0 && idx < siblingRows.length - 1 ? siblingRows[idx + 1] : null;
  const nextLocked = next ? states[idx + 1] === "locked" : false;

  // Fitur Z — bab ini masih TERKUNCI (gate sekuensial Fitur K) → jangan render ruang belajar
  // sama sekali. Ini menutup celahnya di sumber: berlaku untuk klik tombol "Bab berikutnya"
  // MAUPUN URL yang diketik langsung.
  if (idx >= 0 && states[idx] === "locked") {
    return (
      <main className="mx-auto max-w-6xl p-8">
        <div className="rounded-sm border-2 border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-3 text-xl font-bold text-slate-800">Bab ini belum terbuka</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Selesaikan bab sebelumnya dulu (baca materinya sampai tuntas dan lulus ujiannya) untuk
            membuka Bab {content.chapter_number}.
          </p>
          <Link
            href={`/dashboard/courses/${mod.id}`}
            className="mt-6 inline-block rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
          >
            ← Kembali ke {mod.title}
          </Link>
        </div>
      </main>
    );
  }

  // Fitur Q — kunci jawaban esai (key_points/model_answer) tidak boleh sampai ke browser.
  const safeQuiz = quiz ? { ...quiz, questions: stripEssaySecrets(quiz.questions as Record<string, unknown>[]) } : null;

  // Dependen ke `quiz` — sengaja di luar Promise.all di atas.
  let attempts: AttemptRow[] = [];
  if (quiz) {
    const { data } = await supabase
      .from("quiz_attempts")
      .select("id, score, answers, submitted_at")
      .eq("quiz_id", quiz.id)
      .order("submitted_at", { ascending: false });
    attempts = (data ?? []) as AttemptRow[];
  }

  // Progres materi bertahap bab ini (Fitur E) — resume dari step terakhir
  const initialStep =
    ((progressRows ?? []) as { content_id: string; current_step: number }[]).find(
      (p) => p.content_id === contentId
    )?.current_step ?? 0;

  // Sesi chatbot bab ini (RLS: hanya milik user sendiri)
  const chatRemaining = Math.max(0, 5 - (chatSession?.counter_messages ?? 0));
  const chatHistory = (Array.isArray(chatSession?.history) ? chatSession!.history : []) as {
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
        {/* Fitur Z — bab berikutnya yang masih terkunci TIDAK boleh diklik (dulu bisa, dan
            langsung membuka panel generate bab yang seharusnya belum terbuka). */}
        {next ? (
          nextLocked ? (
            <span
              title="Selesaikan bab ini dulu untuk membuka bab berikutnya"
              className="cursor-not-allowed font-medium text-slate-300"
            >
              <i className="bi bi-lock mr-1"></i>
              Bab {next.chapter_number}: {next.title}
            </span>
          ) : (
            <Link
              href={`/dashboard/learn/${next.id}`}
              className="font-medium text-slate-500 hover:text-brand-500"
            >
              Bab {next.chapter_number}: {next.title} →
            </Link>
          )
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
