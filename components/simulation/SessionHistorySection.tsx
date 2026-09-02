import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatCards, { type Stat } from "@/components/simulation/StatCards";
import SessionHistoryTable from "@/components/simulation/SessionHistoryTable";
import {
  fetchSimulationHistory,
  summarize,
  formatDuration,
  KIND_LABEL,
  KIND_ICON,
  type SessionKind,
} from "@/lib/simulationHistory";

/**
 * Fitur DF (planning-update-11) — ringkasan + riwayat sesi sebelumnya, dipasang
 * di BAWAH form pada halaman "sesi baru".
 *
 * Ini SERVER component, dioper ke Runner (client component) lewat prop
 * `historySlot`. Kenapa begitu, bukan langsung ditaruh di halaman: Runner punya
 * fase (setup → running → finishing), dan riwayat cuma boleh tampil di fase
 * setup — kalau ditaruh di halaman, tabel skor lama akan tetap nongol di bawah
 * kamera yang sedang menyala. Dengan pola ini, query tetap di server (tidak ada
 * data tambahan yang dikirim ke browser), tapi Runner yang menentukan kapan
 * menampilkannya.
 *
 * Sesi tanya-jawab TIDAK ikut di daftar wawancara — `fetchSimulationHistory`
 * mengklasifikasikannya sebagai jenis 'qa' tersendiri (keputusan planning #1:
 * kalau digabung, rata-rata skor wawancara jadi campuran dua hal berbeda).
 */

const PREVIEW_ROWS = 10; // keputusan planning #2

export default async function SessionHistorySection({ kind }: { kind: SessionKind }) {
  const supabase = await createClient();
  const rows = await fetchSimulationHistory(supabase, { kind });
  const s = summarize(rows);

  const isPresentation = kind === "presentation";
  const heading = `Hasil ${KIND_LABEL[kind] ?? "Simulasi"} Sebelumnya`;

  const stats: Stat[] = [
    {
      label: "Total Sesi",
      value: String(s.total),
      icon: KIND_ICON[kind] ?? "bi-clipboard2-data-fill",
    },
    {
      label: "Rata-rata Skor",
      value: s.avgScore == null ? "—" : String(s.avgScore),
      icon: "bi-star-fill",
      accent: "text-amber-500",
    },
    {
      label: "Skor Tertinggi",
      value: s.bestScore == null ? "—" : String(s.bestScore),
      icon: "bi-trophy-fill",
      accent: "text-emerald-600",
    },
    isPresentation
      ? {
          label: "Total Waktu Latihan",
          value: formatDuration(s.totalMs),
          icon: "bi-clock-fill",
          accent: "text-brand-500",
        }
      : {
          label: "Pertanyaan Dijawab",
          value: s.totalQuestions > 0 ? String(s.totalQuestions) : "—",
          icon: "bi-patch-question-fill",
          accent: "text-brand-500",
        },
  ];

  // Belum ada sesi sama sekali → satu pesan singkat saja. Menampilkan empat
  // kartu berisi "0" dan tabel kosong cuma bikin halaman ramai tanpa informasi.
  if (s.total === 0) {
    return (
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">{heading}</h2>
        <div className="rounded-sm bg-white p-8 text-center shadow-card">
          <p className="text-sm text-slate-400">
            {isPresentation
              ? "Belum ada sesi presentasi. Hasil latihanmu akan muncul di sini."
              : "Belum ada sesi wawancara. Hasil latihanmu akan muncul di sini."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{heading}</h2>
        <Link href="/simulation" className="text-xs font-semibold text-brand-500 hover:underline">
          Lihat semua →
        </Link>
      </div>

      <StatCards stats={stats} />

      <div className="mt-5">
        <SessionHistoryTable rows={rows.slice(0, PREVIEW_ROWS)} showType={false} />
        {rows.length > PREVIEW_ROWS && (
          <p className="mt-3 text-center text-xs text-slate-400">
            Menampilkan {PREVIEW_ROWS} sesi terbaru dari {rows.length} —{" "}
            <Link href="/simulation" className="font-semibold text-brand-500 hover:underline">
              lihat semua
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
