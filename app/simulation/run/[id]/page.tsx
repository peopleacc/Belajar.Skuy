import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import InterviewRunner from "@/components/simulation/InterviewRunner";
import { getSessionUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sesi Tanya-Jawab — belajar.skuy",
};

/**
 * Fitur BF — menjalankan sesi wawancara yang SUDAH dibuat server (sesi Q&A
 * pasca-presentasi). Bedanya dengan /simulation/interview: pertanyaannya sudah
 * ada, jadi fase setup dilewati sepenuhnya.
 */
export default async function RunSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // RLS menjaga kepemilikan — sesi orang lain tidak akan terbaca (404).
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("simulation_sessions")
    .select("id, type, status, context")
    .eq("id", id)
    .maybeSingle();

  if (!session || session.type !== "interview") notFound();

  const questions: string[] = session.context?.questions ?? [];
  if (questions.length === 0) notFound();

  // Sesi yang sudah selesai jangan bisa dijalankan ulang — segmennya akan
  // ditolak server (status ≠ running), jadi arahkan langsung ke hasilnya.
  if (session.status !== "running") redirect(`/simulation/${id}`);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <InterviewRunner
        presetSessionId={id}
        presetQuestions={questions}
        title={session.context?.role ?? undefined}
      />
    </main>
  );
}
