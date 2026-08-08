import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";

const PASS_SCORE = 70;

type AnyQuestion = {
  type?: "mcq" | "essay";
  answer_mode?: "text" | "voice"; // Fitur R
  question_number: number;
  question_text?: string;
  correct_answer?: "A" | "B" | "C" | "D";
  key_points?: string[];
  model_answer?: string;
};

// Fitur Q — bentuk answers TERSIMPAN (quiz_attempts.answers). Data lama (pra-Fitur Q) = string
// polos huruf jawaban PG; NilaiTab yang mengadaptasinya. Attempt BARU selalu objek per-soal.
type StoredAnswer =
  | { type: "mcq"; choice: string }
  | {
      type: "essay";
      text: string;
      score: number;
      feedback: string;
      matched_points?: string[];
      missing_points?: string[];
    };

// Submit kuis (Modul 6 + Fitur Q): skor dihitung/dinilai DI SERVER (jawaban/kunci tidak
// dipercaya dari client), insert quiz_attempts, dan jika lulus → reset counter chatbot (Modul 8).
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const quizId = typeof body.quizId === "string" ? body.quizId : "";
  const contentId = typeof body.contentId === "string" ? body.contentId : "";
  const answers = (body.answers ?? {}) as Record<string, string>;

  // contentId opsional: kuis kustom (Modul 10) tidak terikat bab
  if (!quizId) {
    return NextResponse.json({ error: "quizId wajib disertakan." }, { status: 400 });
  }
  if (!supabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase belum dikonfigurasi (next/.env.local)." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });
  }

  // RLS memastikan kuis ini milik modul si user. Fetch FRESH dari DB (bukan dari client) —
  // di sinilah key_points/model_answer/correct_answer boleh dibaca (server-only).
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, questions")
    .eq("id", quizId)
    .maybeSingle();
  if (!quiz) {
    return NextResponse.json({ error: "Kuis tidak ditemukan." }, { status: 404 });
  }

  const questions = quiz.questions as AnyQuestion[];
  const total = questions.length;
  const mcqQuestions = questions.filter((q) => (q.type ?? "mcq") === "mcq");
  const essayQuestions = questions.filter((q) => q.type === "essay");

  let correctCount = 0;
  const scores: number[] = [];
  const storedAnswers: Record<string, StoredAnswer> = {};

  for (const q of mcqQuestions) {
    const choice = answers[String(q.question_number)] ?? "";
    const isCorrect = choice === q.correct_answer;
    if (isCorrect) correctCount++;
    scores.push(isCorrect ? 100 : 0);
    storedAnswers[String(q.question_number)] = { type: "mcq", choice };
  }

  if (essayQuestions.length > 0) {
    const items = essayQuestions.map((q) => ({
      question_number: q.question_number,
      question_text: q.question_text ?? "",
      key_points: q.key_points ?? [],
      model_answer: q.model_answer ?? "",
      answer: answers[String(q.question_number)] ?? "",
      // Fitur R — jawaban ini hasil transkrip lisan, penilai diminta toleran ke kalimat
      // terputus/pengulangan (bukan indikasi user salah paham, tapi ciri STT).
      fromVoice: q.answer_mode === "voice",
    }));

    let grades: {
      question_number: number;
      score: number;
      matched_points?: string[] | null;
      missing_points?: string[] | null;
      feedback: string;
    }[];
    try {
      const res = await apiFetch("/api/quiz/grade", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.grades)) {
        throw new Error(data?.error ?? "grading gagal");
      }
      grades = data.grades;
    } catch {
      // Jangan simpan attempt kalau esai gagal dinilai — jawaban user tetap ada di state client.
      return NextResponse.json(
        { error: "Gagal menilai jawaban esai. Coba submit lagi ya." },
        { status: 502 }
      );
    }

    const gradeByNumber = new Map(grades.map((g) => [g.question_number, g]));
    for (const q of essayQuestions) {
      const text = answers[String(q.question_number)] ?? "";
      const g = gradeByNumber.get(q.question_number);
      const score = g?.score ?? 0;
      scores.push(score);
      storedAnswers[String(q.question_number)] = {
        type: "essay",
        text,
        score,
        feedback: g?.feedback ?? "Belum bisa dinilai otomatis.",
        matched_points: g?.matched_points ?? undefined,
        missing_points: g?.missing_points ?? undefined,
      };
    }
  }

  const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const { data: attempt, error: insertErr } = await supabase
    .from("quiz_attempts")
    .insert({ quiz_id: quizId, user_id: user.id, answers: storedAnswers, score })
    .select("id, score, submitted_at")
    .single();
  if (insertErr) {
    return NextResponse.json(
      { error: "Gagal menyimpan hasil kuis. Coba lagi ya." },
      { status: 500 }
    );
  }

  // Lulus → reset kuota chatbot bab ini: Supabase (source of truth) + Redis (lapis cepat)
  let quotaReset = false;
  if (score >= PASS_SCORE && contentId) {
    const { error: resetErr } = await supabase.from("chatbot_sessions").upsert(
      { user_id: user.id, content_id: contentId, counter_messages: 0 },
      { onConflict: "user_id,content_id" }
    );
    quotaReset = !resetErr;

    try {
      await apiFetch(`/api/chat/${contentId}/reset`, {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
      });
    } catch {
      // best-effort: kalau Express mati, counter Redis kadaluarsa sendiri (TTL harian)
    }
  }

  return NextResponse.json({
    attempt,
    score,
    correctCount,
    total,
    passed: score >= PASS_SCORE,
    quotaReset,
  });
}
