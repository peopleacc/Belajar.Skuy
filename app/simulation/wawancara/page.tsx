import type { Metadata } from "next";
import { redirect } from "next/navigation";
import WawancaraRunner from "@/components/simulation/WawancaraRunner";
import SessionHistorySection from "@/components/simulation/SessionHistorySection";
import { getSessionUser } from "@/lib/session";
import { getUserLimits } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Simulasi Wawancara — belajar.skuy",
};

// planning-update-15 — halaman simulasi wawancara bebas (prompt deskripsi / pertanyaan kustom).
export default async function WawancaraPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const limits = await getUserLimits(user.planCode ?? "free");

  return (
    <main className="mx-auto max-w-6xl p-8">
      <WawancaraRunner
        skeletonAllowed={limits.cameraSkeleton}
        historySlot={<SessionHistorySection kind="wawancara" />}
      />
    </main>
  );
}
