// Fitur Q — jangan pernah kirim kunci jawaban ESAI (key_points/model_answer) ke browser.
// Dipakai di setiap titik server yang meneruskan `quiz.questions` ke client: halaman learn,
// halaman kuis kustom, dan kedua proxy yang meneruskan respons Express apa adanya.
//
// Catatan jujur: `correct_answer` soal PILIHAN GANDA sudah terkirim ke client sejak Modul 6
// (arsitektur lama) — itu KELEMAHAN LAMA yang di luar scope perbaikan ini (memperbaikinya butuh
// merombak alur KuisTab/NilaiTab supaya "quiz saat ujian" dan "quiz saat review" dua sumber data
// berbeda; lihat catatan planning-update-5 Fitur Q). Yang WAJIB dijaga di sini hanya field BARU
// (key_points/model_answer) yang memang belum pernah terkirim sama sekali.
export function stripEssaySecrets<T extends Record<string, unknown>>(questions: T[]): T[] {
  return questions.map((q) => {
    if (q?.type === "essay") {
      const clone = { ...q };
      delete clone.key_points;
      delete clone.model_answer;
      return clone;
    }
    return q;
  });
}
