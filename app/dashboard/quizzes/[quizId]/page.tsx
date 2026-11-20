import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import CustomQuizRoom from "@/components/CustomQuizRoom";
import type { AttemptRow, QuizRow } from "@/components/LearnRoom";
import { stripEssaySecrets, stripExamSecrets } from "@/lib/quiz";
import { getSessionUser } from "@/lib/session";
import { getUserLimits } from "@/lib/plans";

export default async function CustomQuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  if (!supabaseConfigured) notFound();

  // Fitur CD — kunci tombol jawab-suara kalau paket belum mencakupnya.
  const sessionUser = await getSessionUser();
  const limits = await getUserLimits(sessionUser?.planCode ?? "free");

  const supabase = await createClient();
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, questions, modules(title)")
    .eq("id", quizId)
    .maybeSingle();
  if (!quiz) notFound();

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, score, answers, submitted_at")
    .eq("quiz_id", quizId)
    .order("submitted_at", { ascending: false });

  // Task 15D-QS (F19 & F24) — Hapus kunci PG & pembahasan pada fase ujian jika belum pernah submit attempt
  const hasAttempted = (attempts ?? []).length > 0;
  const safeQuestions = hasAttempted
    ? stripEssaySecrets(quiz.questions as Record<string, unknown>[])
    : stripExamSecrets(quiz.questions as Record<string, unknown>[]);
  const safeQuiz = { ...quiz, questions: safeQuestions };

  const title =
    ((quiz.modules as unknown as { title: string } | null)?.title ?? "Kuis Kustom").replace(
      /^Kuis Kustom: /,
      ""
    );

  return (
    <main className="mx-auto max-w-6xl p-8">
      <nav className="mb-4 text-xs text-slate-400">
        <Link href="/dashboard/quizzes" className="hover:text-brand-500">
          Quizzes
        </Link>{" "}
        / <span className="font-medium text-brand-500">{title}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        {(quiz.questions as unknown[]).length} soal dari materimu.
      </p>

      <CustomQuizRoom
        quiz={safeQuiz as unknown as QuizRow}
        attempts={(attempts ?? []) as AttemptRow[]}
        voiceLocked={!limits.voicePractice}
      />
    </main>
  );
}
