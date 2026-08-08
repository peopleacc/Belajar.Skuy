// Fitur Y/Z — SATU sumber kebenaran untuk status kunci/buka bab (gate sekuensial Fitur K).
//
// Sebelumnya logic ini cuma ada inline di `courses/[id]/page.tsx`, sementara
// `learn/[contentId]/page.tsx` tidak mengeceknya sama sekali → bab terkunci masih bisa dibuka
// (bahkan digenerate) lewat tombol "Bab berikutnya" atau URL langsung. Diekstrak ke sini supaya
// kedua halaman + proxy generate memakai perhitungan yang PERSIS sama.

export type ChapterState = "locked" | "generate" | "available" | "completed";

export type ChapterStateInput = {
  /** `contents.body` mentah — dipakai membedakan bab yang sudah digenerate vs masih pending. */
  body: unknown;
  /** Sudah diselesaikan: `content_progress.completed_at` terisi, ATAU fallback lulus kuis (data lama). */
  completed: boolean;
};

/** Bab dianggap sudah punya materi kalau body ada dan bukan penanda pending. */
export function isGenerated(body: unknown): boolean {
  return body != null && (body as { status?: string }).status !== "pending";
}

export const PASS_SCORE = 70;

/**
 * Kumpulkan `content_id` bab yang dianggap SELESAI, dari dua sumber:
 * 1. `content_progress.completed_at` terisi (jalur normal sejak Fitur K), dan
 * 2. fallback data lama: pernah lulus kuis (skor >= 70) tapi `completed_at` belum ada.
 *
 * Fallback (2) WAJIB diikutkan di semua pemanggil — kalau tidak, user dengan data lama bisa
 * terkunci dari bab yang sebenarnya sudah dia lulusi.
 *
 * Catatan bentuk data: Supabase menginfer join `quizzes(content_id)` sebagai ARRAY, padahal
 * relasinya many-to-one sehingga runtime-nya OBJEK. Fungsi ini menerima kedua bentuk supaya
 * tidak bergantung pada tebakan tipe.
 */
export function collectCompletedContentIds(
  progressRows: { content_id: string; completed_at: string | null }[] | null | undefined,
  attemptRows: { score: number | string; quizzes: unknown }[] | null | undefined
): Set<string> {
  const completed = new Set<string>();

  for (const p of progressRows ?? []) {
    if (p.completed_at) completed.add(p.content_id);
  }

  for (const a of attemptRows ?? []) {
    if (Number(a.score) < PASS_SCORE) continue;
    const rel = a.quizzes;
    const rows = Array.isArray(rel) ? rel : rel ? [rel] : [];
    for (const r of rows as { content_id?: string }[]) {
      if (r?.content_id) completed.add(r.content_id);
    }
  }

  return completed;
}

/**
 * Hitung state tiap bab secara BERURUTAN: bab ke-N terbuka hanya kalau bab ke-(N-1) sudah
 * `completed`. Bab pertama selalu terjangkau.
 *
 * @param chapters urut berdasarkan `chapter_number` (ASC) — urutan array menentukan hasilnya.
 */
export function computeChapterStates(chapters: ChapterStateInput[]): ChapterState[] {
  let prevCompleted = true; // bab pertama selalu bisa diakses
  return chapters.map((ch) => {
    const generated = isGenerated(ch.body);
    const completed = generated && ch.completed;
    const reachable = prevCompleted;
    prevCompleted = completed;

    if (!reachable) return "locked";
    if (completed) return "completed";
    if (generated) return "available";
    return "generate";
  });
}
