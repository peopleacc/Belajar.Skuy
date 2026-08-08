// Fitur V — daftar STATIS rekomendasi topik untuk halaman Generate Course.
//
// Menggantikan Fitur O (planning-update-5) yang memakai AI + cache Redis. Keputusan baru:
// tanpa AI sama sekali — instan, nol biaya panggilan AI, nol round-trip jaringan.

export type TopicCategory = "sekolah" | "kuliah" | "koding" | "umum";

export type TopicSuggestion = {
  title: string;
  reason: string;
  category: TopicCategory;
};

export const TOPIC_SUGGESTIONS: TopicSuggestion[] = [
  // ===== Sekolah =====
  {
    title: "Matematika Dasar: Aljabar & Persamaan Linear",
    reason: "Fondasi penting sebelum topik matematika lanjutan.",
    category: "sekolah",
  },
  {
    title: "Fisika Dasar: Mekanika Newton",
    reason: "Konsep inti fisika yang jadi dasar banyak topik lain.",
    category: "sekolah",
  },
  {
    title: "Kimia Dasar: Struktur Atom & Ikatan Kimia",
    reason: "Kunci memahami reaksi kimia dan sifat zat.",
    category: "sekolah",
  },
  {
    title: "Biologi: Sistem Organ pada Tubuh Manusia",
    reason: "Materi favorit yang sering keluar di ujian sekolah.",
    category: "sekolah",
  },
  {
    title: "Bahasa Indonesia: Teks Argumentasi & Persuasi",
    reason: "Melatih menyusun tulisan yang runtut dan meyakinkan.",
    category: "sekolah",
  },
  {
    title: "Sejarah Indonesia: Masa Perjuangan Kemerdekaan",
    reason: "Memahami akar terbentuknya Indonesia modern.",
    category: "sekolah",
  },
  {
    title: "Geografi: Litosfer & Bentuk Muka Bumi",
    reason: "Menjelaskan proses di balik gunung, lembah, dan gempa.",
    category: "sekolah",
  },
  {
    title: "Ekonomi: Permintaan, Penawaran & Harga Pasar",
    reason: "Dasar berpikir ekonomi yang kepakai sehari-hari.",
    category: "sekolah",
  },

  // ===== Kuliah =====
  {
    title: "Kalkulus 1: Limit & Turunan",
    reason: "Mata kuliah wajib hampir semua jurusan sains & teknik.",
    category: "kuliah",
  },
  {
    title: "Statistika Dasar: Distribusi & Uji Hipotesis",
    reason: "Bekal utama sebelum mengolah data penelitian.",
    category: "kuliah",
  },
  {
    title: "Aljabar Linear: Matriks & Ruang Vektor",
    reason: "Pondasi machine learning, grafika, dan riset operasi.",
    category: "kuliah",
  },
  {
    title: "Struktur Data & Algoritma Dasar",
    reason: "Materi inti informatika sekaligus bekal wawancara kerja.",
    category: "kuliah",
  },

  // ===== Koding =====
  {
    title: "Dasar-dasar Python untuk Pemula",
    reason: "Bahasa pemrograman paling ramah untuk memulai.",
    category: "koding",
  },
  {
    title: "JavaScript Dasar untuk Web Development",
    reason: "Bahasa wajib kalau ingin membuat website interaktif.",
    category: "koding",
  },
  {
    title: "Basis Data & SQL untuk Pemula",
    reason: "Kemampuan mengolah data yang dicari hampir semua perusahaan.",
    category: "koding",
  },
  {
    title: "Git & GitHub untuk Kolaborasi Tim",
    reason: "Standar industri untuk mengelola versi kode.",
    category: "koding",
  },

  // ===== Umum =====
  {
    title: "Bahasa Inggris untuk Percakapan Sehari-hari",
    reason: "Skill komunikasi yang selalu berguna di mana pun.",
    category: "umum",
  },
  {
    title: "Dasar-dasar Desain Grafis",
    reason: "Cocok untuk yang ingin mulai membuat konten visual.",
    category: "umum",
  },
  {
    title: "Manajemen Keuangan Pribadi",
    reason: "Belajar mengatur pemasukan, tabungan, dan investasi.",
    category: "umum",
  },
  {
    title: "Public Speaking & Presentasi Efektif",
    reason: "Melatih percaya diri menyampaikan ide di depan orang.",
    category: "umum",
  },
];

/** Jumlah chip yang ditampilkan sekali muncul. */
export const SUGGESTION_COUNT = 6;

/** Normalisasi judul untuk pencocokan longgar (buang tanda baca, rapikan spasi, lowercase). */
function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Buang topik yang mirip course yang SUDAH dimiliki user (pencocokan substring dua arah pada
 * bentuk ternormalisasi) — pengganti personalisasi AI Fitur O, tanpa panggilan jaringan.
 */
export function filterOwned(
  topics: TopicSuggestion[],
  ownedTitles: string[]
): TopicSuggestion[] {
  const owned = ownedTitles.map(normalize).filter((t) => t.length > 0);
  if (owned.length === 0) return topics;
  return topics.filter((t) => {
    const title = normalize(t.title);
    return !owned.some((o) => title.includes(o) || o.includes(title));
  });
}

/**
 * Ambil `count` topik acak yang belum dimiliki user. Kalau setelah filter jumlahnya kurang
 * (user sudah punya hampir semua), sisanya diisi dari daftar penuh supaya blok rekomendasi
 * tidak pernah tampil kosong/sedikit aneh.
 */
export function pickSuggestions(
  ownedTitles: string[],
  count: number = SUGGESTION_COUNT
): TopicSuggestion[] {
  const shuffle = (arr: TopicSuggestion[]) =>
    [...arr].sort(() => Math.random() - 0.5);

  const available = shuffle(filterOwned(TOPIC_SUGGESTIONS, ownedTitles));
  if (available.length >= count) return available.slice(0, count);

  const filler = shuffle(TOPIC_SUGGESTIONS).filter(
    (t) => !available.some((a) => a.title === t.title)
  );
  return [...available, ...filler].slice(0, count);
}
