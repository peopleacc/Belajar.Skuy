// Fitur DE (planning-update-11) — sumber TUNGGAL untuk membaca & mengklasifikasi
// riwayat sesi simulasi.
//
// Sebelumnya semua ini hidup di dalam `app/simulation/page.tsx`. Begitu halaman
// "sesi baru" (presentasi & wawancara) ikut butuh daftar yang sama, menyalinnya
// berarti TIGA salinan tipe + helper + query yang harus dijaga tetap sinkron —
// pola masalah yang sudah berulang di project ini (rebalanceQuizTypes vs
// sanitizeQuizTypes, chrome sidebar sebelum SidebarShell). Jadi diekstrak dulu,
// baru dipakai.
//
// Kepemilikan data dijaga RLS ("sesi sendiri dibaca") — modul ini TIDAK menerima
// userId dan tidak menyaring per user secara manual, supaya tidak ada dua lapis
// aturan kepemilikan yang bisa menyimpang.

import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionRow = {
  id: string;
  type: string;
  status: string;
  context: { role?: string; fromSessionId?: string; questionCount?: number } | null;
  created_at: string;
};

export type SessionScores = {
  overall: number | null;
  content: number | null;
  delivery: number | null;
  detail?: {
    total_ms?: number | null;
    wpm_avg?: number | null;
    filler_per_min?: number | null;
    eye_contact?: number | null;
    posture?: number | null;
  } | null;
} | null;

export type ReportFeedback = {
  summary?: string;
  qualitative_note?: string;
  strengths?: string[];
  improvements?: string[];
  unavailable_reason?: string;
} | null;

export type ReportRow = {
  session_id: string;
  scores: SessionScores;
  feedback?: ReportFeedback;
};

/** Baris sesi yang sudah dipasangkan dengan skor dan feedbacknya (kalau ada laporannya). */
export type HistoryRow = {
  session: SessionRow;
  scores: SessionScores;
  feedback?: ReportFeedback;
};

export type SessionKind = "presentation" | "interview" | "qa" | "wawancara";

/**
 * Sesi tanya-jawab secara TEKNIS bertipe 'interview' (Fitur BF) — yang
 * membedakan cuma jejak `fromSessionId` ke presentasi asalnya.
 */
export function sessionKind(s: SessionRow): SessionKind {
  if (s.type === "wawancara") return "wawancara";
  if (s.type === "interview" && s.context?.fromSessionId) return "qa";
  return s.type === "interview" ? "interview" : "presentation";
}

export const KIND_LABEL: Record<SessionKind, string> = {
  presentation: "Simulasi Presentasi",
  interview: "Interview Kerja",
  qa: "Tanya-Jawab Presentasi",
  wawancara: "Wawancara",
};

export const KIND_ICON: Record<SessionKind, string> = {
  presentation: "bi-easel2-fill",
  interview: "bi-briefcase-fill",
  qa: "bi-question-circle-fill",
  wawancara: "bi-mic-fill",
};

export const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  running: { label: "Berjalan", cls: "bg-amber-500/10 text-amber-600" },
  scoring: { label: "Dinilai", cls: "bg-brand-500/10 text-brand-500" },
  done: { label: "Selesai", cls: "bg-emerald-500/10 text-emerald-600" },
  abandoned: { label: "Ditinggal", cls: "bg-slate-500/10 text-slate-500" },
};

/** Tujuan tautan "Lihat" — sesi wawancara yang masih berjalan dilanjutkan, bukan dibuka hasilnya. */
export function sessionHref(s: SessionRow): string {
  const kind = sessionKind(s);
  return kind !== "presentation" && s.status === "running"
    ? `/simulation/run/${s.id}`
    : `/simulation/${s.id}`;
}

/**
 * Ambil sesi + laporannya sekali jalan.
 *
 * `kind` menyaring jenis yang diinginkan: halaman presentasi cuma mau
 * presentasi, halaman wawancara cuma wawancara MURNI (tanya-jawab disaring
 * keluar — keputusan planning #1: kalau ikut, "rata-rata skor wawancara" jadi
 * campuran dua hal yang berbeda). Tanpa `kind` = semua, untuk dashboard.
 */
export async function fetchSimulationHistory(
  supabase: SupabaseClient,
  opts: { kind?: SessionKind; limit?: number } = {}
): Promise<HistoryRow[]> {
  const [{ data: sessions }, { data: reports }] = await Promise.all([
    supabase
      .from("simulation_sessions")
      .select("id, type, status, context, created_at")
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 200),
    // RLS "laporan sesi sendiri dibaca" sudah membatasi ke milik user ini.
    supabase.from("simulation_reports").select("session_id, scores, feedback"),
  ]);

  const rows = (sessions ?? []) as SessionRow[];
  const reportMap = new Map<string, { scores: SessionScores; feedback?: ReportFeedback }>(
    ((reports ?? []) as ReportRow[]).map((r) => [r.session_id, { scores: r.scores, feedback: r.feedback ?? null }])
  );

  const filtered = opts.kind ? rows.filter((s) => sessionKind(s) === opts.kind) : rows;
  return filtered.map((session) => {
    const reportData = reportMap.get(session.id);
    return {
      session,
      scores: reportData?.scores ?? null,
      feedback: reportData?.feedback ?? null,
    };
  });
}

/**
 * Ringkasan angka untuk kartu total.
 *
 * Sesi TANPA laporan tetap dihitung di `total`, tapi TIDAK ikut rata-rata —
 * aturan yang sama dipakai chart dashboard (Fitur CF), supaya sesi yang belum
 * dinilai tidak menarik rata-rata turun secara menyesatkan.
 */
export function summarize(rows: HistoryRow[]) {
  const scored = rows.filter((r) => r.scores?.overall != null);
  const overalls = scored.map((r) => r.scores!.overall!);

  const totalMs = rows.reduce((a, r) => a + (r.scores?.detail?.total_ms ?? 0), 0);
  const totalQuestions = rows.reduce(
    (a, r) => a + (r.session.context?.questionCount ?? 0),
    0
  );

  return {
    total: rows.length,
    avgScore: overalls.length
      ? Math.round(overalls.reduce((a, b) => a + b, 0) / overalls.length)
      : null,
    bestScore: overalls.length ? Math.max(...overalls) : null,
    totalMs,
    totalQuestions,
  };
}

/** "1j 24m" / "24m" / "—" — dipakai kartu Total Waktu Latihan. */
export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  return `${Math.floor(totalMin / 60)}j ${totalMin % 60}m`;
}
