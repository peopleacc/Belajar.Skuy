import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import InterviewRunner from "@/components/simulation/InterviewRunner";
import WawancaraRunner from "@/components/simulation/WawancaraRunner";
import SessionRunner from "@/components/simulation/SessionRunner";
import { getSessionUser } from "@/lib/session";
import { getUserLimits } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Lanjutkan Sesi Simulasi — belajar.skuy",
};

/**
 * Task 6J-AS: Universal Session Resumer
 * Melanjutkan sesi simulasi yang sedang berjalan (running) dari segmen berikutnya:
 * Mendukung interview (Q&A / wawancara kerja), wawancara bebas, dan presentasi.
 */
export default async function RunSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const limits = await getUserLimits(user.planCode ?? "free");

  // RLS menjaga kepemilikan — sesi orang lain tidak akan terbaca (404).
  const supabase = await createClient();
  const [{ data: session }, { data: segRows }] = await Promise.all([
    supabase
      .from("simulation_sessions")
      .select("id, type, status, context, settings")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("simulation_segments")
      .select("index")
      .eq("session_id", id),
  ]);

  if (!session) notFound();

  // Sesi yang sudah selesai jangan bisa dijalankan ulang — segmennya akan
  // ditolak server (status ≠ running), jadi arahkan langsung ke hasilnya.
  if (session.status !== "running") redirect(`/simulation/${id}`);

  // F63: Cari index pertama yang belum terjawab (bukan answeredCount yang melompat jika urutan upload teracak)
  const totalExpected = session.type === "presentation"
    ? (session.context?.totalSlides || session.context?.slides?.length || 1)
    : (session.context?.questions?.length || 5);

  const answeredIndices = new Set((segRows ?? []).map((s) => s.index));
  let firstMissingIndex = totalExpected;
  for (let i = 0; i < totalExpected; i++) {
    if (!answeredIndices.has(i)) {
      firstMissingIndex = i;
      break;
    }
  }

  // Jika semua segmen sudah terjawab, arahkan langsung ke laporan hasil
  if (firstMissingIndex >= totalExpected) {
    redirect(`/simulation/${id}`);
  }

  const sessionLang = session.settings?.language === "en" ? "en" : "id";
  const visualEnabled = session.settings?.visualEnabled !== false;

  // 1. Sesi Presentasi
  if (session.type === "presentation") {
    const totalSlides = session.context?.totalSlides || session.context?.slides?.length || 1;
    return (
      <main className="mx-auto max-w-6xl p-8">
        <SessionRunner
          presetSessionId={id}
          presetTotalSlides={totalSlides}
          initialIndex={firstMissingIndex}
          skeletonAllowed={limits.cameraSkeleton}
        />
      </main>
    );
  }

  // 2. Sesi Wawancara Mandiri / Bebas (F57 & F62)
  if (session.type === "wawancara") {
    const questions: string[] = session.context?.questions ?? [];
    return (
      <main className="mx-auto max-w-6xl p-8">
        <WawancaraRunner
          presetSessionId={id}
          presetQuestions={questions}
          title={session.context?.title ?? undefined}
          initialIndex={firstMissingIndex}
          skeletonAllowed={limits.cameraSkeleton}
          presetSessionLang={sessionLang}
          presetVisualEnabled={visualEnabled}
        />
      </main>
    );
  }

  // 3. Sesi Interview Kerja / Q&A Presentasi (F62)
  const questions: string[] = session.context?.questions ?? [];
  return (
    <main className="mx-auto max-w-6xl p-8">
      <InterviewRunner
        presetSessionId={id}
        presetQuestions={questions}
        title={session.context?.role ?? session.context?.title ?? undefined}
        initialIndex={firstMissingIndex}
        skeletonAllowed={limits.cameraSkeleton}
        presetSessionLang={sessionLang}
        presetVisualEnabled={visualEnabled}
      />
    </main>
  );
}
