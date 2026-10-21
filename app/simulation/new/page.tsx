import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SessionRunner from "@/components/simulation/SessionRunner";
import SessionHistorySection from "@/components/simulation/SessionHistorySection";
import { getSessionUser } from "@/lib/session";
import { getUserLimits } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Sesi Presentasi Baru — belajar.skuy",
};

// Fitur BA & BB — pembungkus server: cek login, lalu serahkan seluruh alur
// (unggah → preview → rekam per slide) ke SessionRunner di client.
export default async function NewSimulationPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const limits = await getUserLimits(user.planCode ?? "free");

  return (
    <main className="mx-auto max-w-6xl p-8">
      <SessionRunner
        skeletonAllowed={limits.cameraSkeleton}
        historySlot={<SessionHistorySection kind="presentation" />}
      />
    </main>
  );
}
