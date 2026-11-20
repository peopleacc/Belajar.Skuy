// Fitur Q & Task 15D-QS (F19 & F24) — Penghapusan Kunci Jawaban & Pembahasan pada Fase Ujian.
// Mencegah siswa melihat correct_answer atau explanation melalui browser DevTools sebelum submit.

/**
 * Menghilangkan seluruh rahasia soal pada fase ujian:
 * - Kunci jawaban pilihan ganda (correct_answer)
 * - Pembahasan jawaban (explanation)
 * - Poin kunci rubrik esai (key_points)
 * - Model jawaban acuan esai (model_answer)
 *
 * Dipakai saat menyajikan soal kepada siswa sebelum kuis di-submit.
 */
export function stripExamSecrets<T extends Record<string, unknown>>(questions: T[]): T[] {
  return questions.map((q) => {
    const clone = { ...q };
    delete clone.correct_answer;
    delete clone.explanation;
    delete clone.key_points;
    delete clone.model_answer;
    return clone as T;
  });
}

/**
 * Menghilangkan rahasia internal esai (key_points & model_answer)
 * tetapi tetap mempertahankan correct_answer & explanation untuk fase review/nilai.
 */
export function stripEssaySecrets<T extends Record<string, unknown>>(questions: T[]): T[] {
  return questions.map((q) => {
    if (q?.type === "essay") {
      const clone = { ...q };
      delete clone.key_points;
      delete clone.model_answer;
      return clone as T;
    }
    return q;
  });
}
