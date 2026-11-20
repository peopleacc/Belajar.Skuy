// Fitur Y/Z & Track 13 — SATU sumber kebenaran untuk status bab kursus.
//
// Sejak Track 13 (Non-Linear Chapter Access & Arbitrary Chapter Generation):
// Pembatasan sekuensial kaku (gate sekuensial Fitur K) dibongkar agar pengguna bebas
// meng-generate dan mempelajari bab mana saja tanpa terhalang gembok "Bab ini belum terbuka".
// Setiap bab dihitung secara modular:
// - completed: materi sudah tuntas dipelajari / lulus kuis.
// - available: materi sudah di-generate dan siap dipelajari.
// - generate : materi belum di-generate (siap di-generate instan oleh pengguna).

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
 * Hitung state tiap bab kursus.
 * Track 13: Semua bab dapat diakses dan di-generate kapan saja tanpa mengunci bab
 * berikutnya (non-linear learning). Opsi `enforceSequential` dapat diberikan jika
 * suatu saat dibutuhkan mode sekuensial ketat.
 *
 * @param chapters urut berdasarkan `chapter_number` (ASC)
 * @param options opsi tambahan (mis. enforceSequential)
 */
export function computeChapterStates(
  chapters: ChapterStateInput[],
  options?: { enforceSequential?: boolean }
): ChapterState[] {
  const sequential = options?.enforceSequential === true;
  let prevCompleted = true;

  return chapters.map((ch) => {
    const generated = isGenerated(ch.body);
    const completed = generated && ch.completed;

    if (sequential) {
      const reachable = prevCompleted;
      prevCompleted = completed;
      if (!reachable) return "locked";
    }

    if (completed) return "completed";
    if (generated) return "available";
    return "generate";
  });
}
