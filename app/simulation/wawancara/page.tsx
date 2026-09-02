import type { Metadata } from "next";
import { redirect } from "next/navigation";
import WawancaraRunner from "@/components/simulation/WawancaraRunner";
import SessionHistorySection from "@/components/simulation/SessionHistorySection";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Simulasi Wawancara — belajar.skuy",
};

// planning-update-15 — halaman simulasi wawancara bebas (prompt deskripsi / pertanyaan kustom).
export default async function WawancaraPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-6xl p-8">
      <WawancaraRunner historySlot={<SessionHistorySection kind="wawancara" />} />
    </main>
  );
}
