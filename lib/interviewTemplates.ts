/**
 * Katalog Skenario Wawancara Terkurasi (Curated Free Interview Packs)
 * Menyediakan skenario latihan tanya-jawab siap pakai (Mode Free)
 * dan memuat rubrik kata kunci untuk penilaian matematis instan.
 *
 * Kepatuhan: Aturan F (Zero Emoji, 100% Bootstrap Icons), Pure Light Mode.
 */

export interface TemplateQuestion {
  index: number;
  question: string;
  expectedKeywords: string[];
  tips: string;
}

export interface InterviewTemplate {
  id: string;
  category: "job" | "general";
  title: string;
  badge: string;
  description: string;
  icon: string; // Bootstrap Icon class, mis. "bi-briefcase-fill"
  role: string;
  level: "fresh" | "menengah" | "senior";
  targetTimePerQuestionSec: number;
  questions: TemplateQuestion[];
}

export const INTERVIEW_TEMPLATES: InterviewTemplate[] = [
  // ── Skenario Interview Kerja (Job Interview) ──
  {
    id: "job-hrd-general",
    category: "job",
    title: "Wawancara HRD & Kepribadian",
    badge: "Populer",
    description: "Pertanyaan inti seputar perkenalan diri, motivasi karier, kelebihan, serta cara mengatasi kendala kerja.",
    icon: "bi-person-badge-fill",
    role: "Staff HRD / Umum",
    level: "menengah",
    targetTimePerQuestionSec: 60,
    questions: [
      {
        index: 0,
        question: "Ceritakan tentang diri Anda, latar belakang pendidikan, dan apa yang memotivasi Anda melamar di posisi ini?",
        expectedKeywords: ["pendidikan", "pengalaman", "motivasi", "karier", "keahlian", "tujuan"],
        tips: "Gunakan metode Present-Past-Future: jelaskan kondisi sekarang, pengalaman relevan, dan visi ke depan.",
      },
      {
        index: 1,
        question: "Apa kelebihan terbesar Anda, dan bagaimana kelebihan tersebut mendukung performa kerja Anda?",
        expectedKeywords: ["kelebihan", "disiplin", "komunikasi", "kolaborasi", "solutif", "kontribusi"],
        tips: "Sebutkan 1-2 kelebihan utama dan sertakan contoh nyata penerapannya dalam tim atau proyek.",
      },
      {
        index: 2,
        question: "Ceritakan situasi saat Anda menghadapi tekanan deadline yang ketat, dan bagaimana Anda mengatasinya?",
        expectedKeywords: ["prioritas", "manajemen waktu", "tenggat", "fokus", "koordinasi", "selesai"],
        tips: "Gunakan metode STAR (Situation, Task, Action, Result) untuk menjelaskan tindakan terstruktur Anda.",
      },
      {
        index: 3,
        question: "Bagaimana cara Anda menyelesaikan perbedaan pendapat atau konflik kerja dengan rekan satu tim?",
        expectedKeywords: ["diskusi", "musyawarah", "mendengarkan", "komunikasi", "solusi", "profesional"],
        tips: "Tunjukkan empati, kemauan mendengarkan sudut pandang rekan, dan fokus pada target bersama tim.",
      },
      {
        index: 4,
        question: "Di mana Anda melihat diri Anda dalam 3 hingga 5 tahun ke depan dalam perjalanan karier ini?",
        expectedKeywords: ["berkembang", "kontribusi", "keahlian", "tanggung jawab", "komitmen", "jangka panjang"],
        tips: "Tunjukkan komitmen belajar, peningkatan kompetensi, dan kontribusi nyata bagi kemajuan organisasi.",
      },
    ],
  },
  {
    id: "job-frontend-dev",
    category: "job",
    title: "Frontend Web Developer",
    badge: "Teknis",
    description: "Evaluasi kompetensi React, Next.js, manajemen state, performa web, dan integrasi API modern.",
    icon: "bi-code-slash",
    role: "Frontend Developer",
    level: "menengah",
    targetTimePerQuestionSec: 60,
    questions: [
      {
        index: 0,
        question: "Jelaskan pengalaman Anda dalam membangun antarmuka web modern dengan React atau Next.js?",
        expectedKeywords: ["react", "next.js", "komponen", "state", "props", "ui", "typescript"],
        tips: "Jelaskan arsitektur komponen yang pernah Anda buat dan pendekatan responsif yang Anda terapkan.",
      },
      {
        index: 1,
        question: "Bagaimana pendekatan Anda dalam mengelola state aplikasi skala menengah hingga kompleks?",
        expectedKeywords: ["state", "zustand", "redux", "context", "hook", "immutable", "re-render"],
        tips: "Bandingkan kapan memilih local state, server state (React Query/SWR), dan global client store.",
      },
      {
        index: 2,
        question: "Langkah konkret apa yang Anda lakukan untuk mengoptimalkan performa halaman web (Web Vitals)?",
        expectedKeywords: ["lazy loading", "bundle size", "caching", "lcp", "cls", "image optimization", "memo"],
        tips: "Sebutkan metrik Core Web Vitals (LCP, FID/INP, CLS) dan teknik code-splitting / dynamic import.",
      },
      {
        index: 3,
        question: "Ceritakan bug frontend paling sulit yang pernah Anda temukan dan bagaimana proses investigasi Anda?",
        expectedKeywords: ["debugging", "devtools", "console", "network", "root cause", "solusi", "testing"],
        tips: "Jelaskan langkah investigasi sistematis: reproduksi bug, isolasi komponen, hingga verifikasi perbaikan.",
      },
      {
        index: 4,
        question: "Bagaimana cara Anda memastikan kode antarmuka konsisten, ramah aksesibilitas (a11y), dan responsif?",
        expectedKeywords: ["aksesibilitas", "aria", "semantic html", "mobile responsive", "clean code", "design system"],
        tips: "Tekankan penggunaan semantic HTML, kontras warna yang sesuai standar, dan tata letak CSS modern.",
      },
    ],
  },
  {
    id: "job-fresh-graduate",
    category: "job",
    title: "Fresh Graduate & Lulusan Baru",
    badge: "Cepat",
    description: "Latihan wawancara terfokus untuk pemula: pengalaman skripsi/organisasi, daya adaptasi, dan inisiatif belajar.",
    icon: "bi-mortarboard-fill",
    role: "Junior Associate / Trainee",
    level: "fresh",
    targetTimePerQuestionSec: 45,
    questions: [
      {
        index: 0,
        question: "Ceritakan proyek kampus, skripsi, atau kegiatan magang yang paling membanggakan bagi Anda?",
        expectedKeywords: ["kampus", "proyek", "skripsi", "magang", "tanggung jawab", "hasil", "belajar"],
        tips: "Jelaskan peran spesifik Anda dan hasil nyata yang berhasil dicapai dari proyek tersebut.",
      },
      {
        index: 1,
        question: "Ketika harus mempelajari teknologi atau keterampilan baru dalam waktu singkat, bagaimana strategi Anda?",
        expectedKeywords: ["inisiatif", "dokumentasi", "praktek", "eksplorasi", "cepat", "bertanya", "disiplin"],
        tips: "Tunjukkan antusiasme belajar (*growth mindset*) dan langkah praktis Anda membaca panduan resmi.",
      },
      {
        index: 2,
        question: "Ceritakan pengalaman saat rencana tim tidak berjalan sesuai harapan, dan apa pelajaran yang Anda petik?",
        expectedKeywords: ["evaluasi", "pelajaran", "fleksibel", "adaptasi", "tanggung jawab", "perbaikan"],
        tips: "Jangan menyalahkan pihak lain. Fokus pada refleksi diri dan langkah perbaikan yang dipelajari.",
      },
      {
        index: 3,
        question: "Mengapa Anda memilih untuk memulai karier di bidang ini, dan apa ekspektasi Anda terhadap lingkungan kerja?",
        expectedKeywords: ["minat", "passion", "bimbingan", "kolaborasi", "kontribusi", "lingkungan positif"],
        tips: "Kaitkan minat akademis/proyek pribadi Anda dengan nilai-nilai profesionalisme industri.",
      },
    ],
  },
  {
    id: "job-uiux-designer",
    category: "job",
    title: "UI/UX & Product Designer",
    badge: "Desain",
    description: "Evaluasi pemahaman user research, design system, prototyping di Figma, serta validasi solusi berbasis data.",
    icon: "bi-palette-fill",
    role: "UI/UX Designer",
    level: "menengah",
    targetTimePerQuestionSec: 60,
    questions: [
      {
        index: 0,
        question: "Ceritakan proses desain Anda dari tahap user research hingga perancangan high-fidelity prototype?",
        expectedKeywords: ["research", "user persona", "wireframe", "figma", "prototype", "usability testing"],
        tips: "Jelaskan metodologi Design Thinking (Empathize, Define, Ideate, Prototype, Test).",
      },
      {
        index: 1,
        question: "Bagaimana cara Anda menyelaraskan kebutuhan pengguna (user needs) dengan target bisnis perusahaan?",
        expectedKeywords: ["prioritas", "business goal", "trade-off", "stakeholder", "metrik", "roi"],
        tips: "Berikan contoh konkret negosiasi scope fitur tanpa mengorbankan pengalaman pengguna yang esensial.",
      },
      {
        index: 2,
        question: "Ceritakan pengalaman Anda dalam membangun atau memelihara Design System untuk konsistensi produk?",
        expectedKeywords: ["design system", "token", "komponen", "konsistensi", "developer handoff", "skalabilitas"],
        tips: "Fokus pada efisiensi kolaborasi antara designer dan frontend engineer.",
      },
      {
        index: 3,
        question: "Bagaimana cara Anda mengukur kesuksesan sebuah desain antarmuka setelah dirilis ke pengguna riil?",
        expectedKeywords: ["metrik", "conversion rate", "sus score", "retention", "drop-off", "feedback pengguna"],
        tips: "Sebutkan metrik kuantitatif (konversi, task success rate) dan kualitatif (interview pengguna).",
      },
    ],
  },
  {
    id: "job-customer-success",
    category: "job",
    title: "Customer Success Specialist",
    badge: "Operasional",
    description: "Evaluasi empati komunikasi, resolusi komplain pelanggan, mitigasi churn, dan manajemen retensi akun.",
    icon: "bi-headset",
    role: "Customer Success Specialist",
    level: "menengah",
    targetTimePerQuestionSec: 60,
    questions: [
      {
        index: 0,
        question: "Bagaimana pendekatan Anda saat menghadapi pelanggan yang sangat kecewa atau marah terhadap layanan?",
        expectedKeywords: ["empati", "mendengarkan aktif", "tenang", "solutif", "tindak lanjut", "kepercayaan"],
        tips: "Dengarkan keluhan sepenuhnya tanpa menyela, tunjukkan empati tulus, lalu tawarkan solusi konkret.",
      },
      {
        index: 1,
        question: "Ceritakan strategi Anda dalam membimbing onboarding pengguna baru agar cepat merasakan nilai produk (*time-to-value*)?",
        expectedKeywords: ["onboarding", "panduan", "adopsi", "proaktif", "pelatihan", "tujuan pelanggan"],
        tips: "Jelaskan langkah proaktif Anda memastikan pelanggan mencapai tujuan pertama mereka.",
      },
      {
        index: 2,
        question: "Bagaimana cara Anda mengidentifikasi sinyal dini pelanggan yang berpotensi membatalkan langganan (churn)?",
        expectedKeywords: ["analisis penggunaan", "indikator churn", "interaksi berkurang", "solusi proaktif", "retensi"],
        tips: "Sebutkan data monitoring keaktifan akun dan program intervensi sebelum pelanggan memutuskan berhenti.",
      },
      {
        index: 3,
        question: "Bagaimana Anda menyampaikan masukan kritis atau permintaan fitur dari pelanggan ke tim produk?",
        expectedKeywords: ["dokumentasi", "kategori", "dampak bisnis", "kolaborasi tim", "transparansi"],
        tips: "Jelaskan cara Anda menyaring data masalah tanpa membuat janji palsu kepada pelanggan.",
      },
    ],
  },
  {
    id: "job-business-dev",
    category: "job",
    title: "Business Development & Sales",
    badge: "Bisnis",
    description: "Evaluasi strategi pitching, negosiasi kemitraan strategis, analisis pasar, dan pencapaian target penjualan.",
    icon: "bi-graph-up-arrow",
    role: "Business Development Associate",
    level: "menengah",
    targetTimePerQuestionSec: 60,
    questions: [
      {
        index: 0,
        question: "Bagaimana langkah Anda dalam memetakan target pasar baru dan mendekati calon mitra strategis?",
        expectedKeywords: ["riset pasar", "prospek", "value proposition", "pitching", "pendekatan", "kemitraan"],
        tips: "Jelaskan kriteria kualifikasi prospek (ICP) dan formulasi pesan pembuka yang relevan.",
      },
      {
        index: 1,
        question: "Ceritakan negosiasi tersulit yang pernah Anda hadapi dan bagaimana Anda mencapai kesepakatan win-win?",
        expectedKeywords: ["negosiasi", "win-win", "fleksibel", "titik temu", "kesepakatan", "kepercayaan"],
        tips: "Fokus pada pemahaman kebutuhan terdalam mitra, bukan sekadar memaksakan harga atau kontrak.",
      },
      {
        index: 2,
        question: "Ketika performa penjualan berada di bawah target kuartal, strategi pemulihan apa yang Anda jalankan?",
        expectedKeywords: ["evaluasi pipeline", "akselerasi", "prioritas prospek", "inisiatif baru", "resiliensi"],
        tips: "Tunjukkan akuntabilitas, analisis bottleneck di sales pipeline, dan tindakan perbaikan cepat.",
      },
      {
        index: 3,
        question: "Bagaimana cara Anda menjaga hubungan jangka panjang dengan klien utama setelah kesepakatan tercapai?",
        expectedKeywords: ["account management", "komunikasi berkala", "cross-selling", "upselling", "loyalitas"],
        tips: "Tekankan penyediaan nilai tambah berkelanjutan untuk mendorong perpanjangan kontrak.",
      },
    ],
  },

  // ── Skenario Wawancara Bebas / Umum (General Interview) ──
  {
    id: "gen-beasiswa-lpdp",
    category: "general",
    title: "Wawancara Beasiswa Studi Lanjut",
    badge: "Akademik",
    description: "Simulasi seleksi beasiswa magister/doktoral: kontribusi bangsa, rencana studi, kepemimpinan, dan riset.",
    icon: "bi-award-fill",
    role: "Kandidat Beasiswa",
    level: "menengah",
    targetTimePerQuestionSec: 60,
    questions: [
      {
        index: 0,
        question: "Jelaskan rencana studi Anda dan mengapa program studi yang Anda pilih sangat krusial bagi Indonesia?",
        expectedKeywords: ["rencana studi", "urgensi", "isu nasional", "kurikulum", "kontribusi", "indonesia"],
        tips: "Tunjukkan urgensi masalah di Indonesia dan bagaimana ilmu yang dipelajari menjadi solusi konkret.",
      },
      {
        index: 1,
        question: "Bagaimana rekam jejak kepemimpinan Anda dan contoh kontribusi nyata yang pernah Anda berikan?",
        expectedKeywords: ["kepemimpinan", "inisiatif", "komunitas", "dampak", "tim", "solusi", "masyarakat"],
        tips: "Fokus pada aksi kepemimpinan yang membawa dampak nyata bagi orang banyak atau komunitas.",
      },
      {
        index: 2,
        question: "Apa rencana pengabdian dan aksi konkret Anda dalam 5 tahun pertama setelah menyelesaikan studi?",
        expectedKeywords: ["kembali", "pengabdian", "implementasi", "kolaborasi", "instansi", "target konkret"],
        tips: "Jelaskan secara realistis instansi atau sektor di mana Anda akan berkarier dan membangun dampak.",
      },
      {
        index: 3,
        question: "Jika terjadi kegagalan atau hambatan riset selama studi di luar daerah/negeri, bagaimana mitigasi Anda?",
        expectedKeywords: ["resiliensi", "mitigasi", "adaptasi", "jejaring", "pembimbing", "solutif"],
        tips: "Tunjukkan kematangan emosional, daya tahan adaptasi, dan keterbukaan meminta bimbingan akademis.",
      },
    ],
  },
  {
    id: "gen-organisasi-bem",
    category: "general",
    title: "Seleksi Kepengurusan Organisasi",
    badge: "Kampus",
    description: "Wawancara seleksi BEM, Himpunan Mahasiswa, atau kepanitiaan: loyalitas, manajemen waktu, dan kerja tim.",
    icon: "bi-people-fill",
    role: "Kandidat Pengurus",
    level: "fresh",
    targetTimePerQuestionSec: 45,
    questions: [
      {
        index: 0,
        question: "Apa motivasi utama Anda mendaftar di divisi ini, dan gagasan baru apa yang ingin Anda bawa?",
        expectedKeywords: ["motivasi", "inovasi", "program kerja", "divisi", "kontribusi", "tujuan"],
        tips: "Sebutkan alasan spesifik memilih divisi tersebut dan 1 program kerja kreatif yang realistis.",
      },
      {
        index: 1,
        question: "Bagaimana strategi Anda menyeimbangkan tanggung jawab akademik perkuliahan dengan amanah organisasi?",
        expectedKeywords: ["manajemen waktu", "prioritas", "jadwal", "komitmen", "disiplin", "komunikasi"],
        tips: "Sebutkan teknik manajemen waktu Anda (misalnya to-do list, skala prioritas, dan komunikasi terbuka).",
      },
      {
        index: 2,
        question: "Bila rekan satu divisi Anda menghilang atau pasif menjelang hari pelaksanaan kegiatan, apa tindakan Anda?",
        expectedKeywords: ["pendekatan", "komunikasi persuasif", "empati", "solusi", "tanggung jawab tim"],
        tips: "Gunakan pendekatan persuasif secara personal terlebih dahulu sebelum eskalasi ke koordinator divisi.",
      },
    ],
  },
  {
    id: "gen-public-speaking",
    category: "general",
    title: "Ujian Sidang & Presentasi Argumen",
    badge: "Komunikasi",
    description: "Latihan mempertahankan argumen ilmiah, menjawab pertanyaan penguji secara taktis, dan artikulasi ide.",
    icon: "bi-megaphone-fill",
    role: "Penyaji / Sidang",
    level: "menengah",
    targetTimePerQuestionSec: 60,
    questions: [
      {
        index: 0,
        question: "Jelaskan kebaruan (novelty) dan keterbatasan utama dari gagasan atau karya ilmiah yang Anda ajukan?",
        expectedKeywords: ["kebaruan", "novelty", "metodologi", "keterbatasan", "argumen", "validitas"],
        tips: "Akui keterbatasan secara jujur dan ilmiah, lalu tekankan batasan ruang lingkup riset Anda.",
      },
      {
        index: 1,
        question: "Bagaimana Anda membuktikan bahwa kesimpulan yang Anda peroleh didukung data yang valid dan reliabel?",
        expectedKeywords: ["data", "validasi", "metode", "analisis", "bukti", "pengujian", "objektif"],
        tips: "Rujuk metode pengumpulan data dan analisis statistik atau verifikasi kualitatif yang Anda gunakan.",
      },
      {
        index: 2,
        question: "Jika salah satu dewan penguji membantah hipotesis Anda, bagaimana Anda merespons secara santun?",
        expectedKeywords: ["apresiasi", "terbuka", "landasan teori", "diskusi ilmiah", "santun", "masukan"],
        tips: "Apresiasi masukan dewan penguji terlebih dahulu, lalu paparkan landasan data yang mendasari hipotesis Anda.",
      },
    ],
  },
];

/** Ambil seluruh template berdasarkan kategori */
export function getTemplatesByCategory(category: "job" | "general"): InterviewTemplate[] {
  return INTERVIEW_TEMPLATES.filter((t) => t.category === category);
}

/** Ambil template berdasarkan ID */
export function getTemplateById(id: string): InterviewTemplate | undefined {
  return INTERVIEW_TEMPLATES.find((t) => t.id === id);
}

/** Alias untuk koleksi template kurasi */
export const CURATED_INTERVIEW_TEMPLATES = INTERVIEW_TEMPLATES;


