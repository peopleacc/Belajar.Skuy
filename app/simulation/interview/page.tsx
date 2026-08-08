import type { Metadata } from "next";
import { redirect } from "next/navigation";
import InterviewRunner from "@/components/simulation/InterviewRunner";
import SessionHistorySection from "@/components/simulation/SessionHistorySection";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Simulasi Wawancara — belajar.skuy",
};

// Fitur BE — pembungkus server: cek login, sisanya di client.
export default async function NewInterviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-6xl p-8">
      <InterviewRunner historySlot={<SessionHistorySection kind="interview" />} />
    </main>
  );
}
