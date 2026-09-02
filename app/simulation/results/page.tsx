import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchSimulationHistory } from "@/lib/simulationHistory";
import CombinedResultsTable from "@/components/simulation/CombinedResultsTable";

export const metadata: Metadata = {
  title: "Rekap Hasil Simulasi — belajar.skuy",
};

// planning-update-15 — halaman Rekap Hasil Simulasi Gabungan (Presentasi, Q&A, Interview, Wawancara).
export default async function SimulationResultsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const history = await fetchSimulationHistory(supabase);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          📊 Rekap Hasil Simulasi Gabungan
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Lihat seluruh riwayat &amp; evaluasi performa latihan presentasi, Q&amp;A, interview kerja, &amp; wawancara bebas.
        </p>
      </div>

      <CombinedResultsTable initialRows={history} />
    </main>
  );
}
