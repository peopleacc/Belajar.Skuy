"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

const PENDIDIKAN_OPTIONS = [
  { id: "SD", label: "SD / Sederajat", placeholder: "Contoh: Umum / Kurikulum Merdeka" },
  { id: "SMP", label: "SMP / MTs", placeholder: "Contoh: Umum / Kurikulum Merdeka" },
  { id: "SMA/SMK", label: "SMA / SMK / MA", placeholder: "Contoh: IPA / IPS / Rekayasa Perangkat Lunak" },
  { id: "Kuliah", label: "Perguruan Tinggi (D3/S1)", placeholder: "Contoh: Teknik Informatika / Manajemen" },
  { id: "Magister", label: "Pascasarjana (S2/S3)", placeholder: "Contoh: Magister Ilmu Komputer" },
  { id: "Kerja", label: "Profesional / Bekerja", placeholder: "Contoh: Software Engineering / Pemasaran" },
];

const LEVEL_BICARA_OPTIONS = [
  {
    id: "pemula",
    title: "Pemula",
    subtitle: "Baru mulai, butuh arahan ramah.",
    icon: "bi-mic",
  },
  {
    id: "menengah",
    title: "Menengah",
    subtitle: "Cukup percaya diri, ingin lebih rapi.",
    icon: "bi-mic-fill",
  },
  {
    id: "mahir",
    title: "Mahir",
    subtitle: "Terbiasa tampil, ingin lebih tajam.",
    icon: "bi-trophy-fill",
  },
];

const TUJUAN_OPTIONS = [
  {
    id: "generate_course",
    title: "Buat Kursus",
    desc: "Materi, referensi kurasi dari jurnal & Wikipedia, serta kuis dari satu topik.",
    icon: "bi-journal-bookmark-fill",
    badge: null,
  },
  {
    id: "simulasi_presentasi",
    title: "Latihan Simulasi",
    desc: "Latihan presentasi dan wawancara dengan audio AI dan evaluasi penyampaian.",
    icon: "bi-mic-fill",
    badge: "Beta",
  },
  {
    id: "keduanya",
    title: "Semua Fitur",
    desc: "Belajar materi sekaligus melatih cara menyampaikannya di depan umum.",
    icon: "bi-grid-fill",
    badge: "Lengkap",
  },
];

interface PlanOption {
  code: string;
  name: string;
  tier: string;
  price: string;
  period: string;
  badge?: string;
  isPopular?: boolean;
  desc: string;
  features: string[];
  cta: string;
}

const SIMULASI_PLANS: PlanOption[] = [
  {
    code: "premium_presentasi",
    name: "Premium Presentasi",
    tier: "Fokus Bicara",
    price: "Rp 60.000",
    period: "/bulan",
    badge: "Paling Pas",
    isPopular: false,
    desc: "Latih presentasi slide dan wawancara kerja terarah dengan evaluasi AI instan.",
    features: [
      "Simulasi Presentasi 10x / minggu",
      "Simulasi Wawancara 10x / minggu",
      "Evaluasi isi materi & cara penyampaian bicara",
      "Latihan audio AI & transkripsi suara instan",
    ],
    cta: "Pilih Paket Presentasi",
  },
  {
    code: "premium_gabungan",
    name: "Premium Gabungan",
    tier: "Terlengkap & Populer",
    price: "Rp 100.000",
    period: "/bulan",
    badge: "Paling Populer",
    isPopular: true,
    desc: "Kombinasi terbaik: simulasi presentasi & wawancara plus generator modul kursus lengkap.",
    features: [
      "Simulasi Presentasi 15x / minggu",
      "Simulasi Wawancara 15x / minggu",
      "5 modul kursus baru per hari",
      "Bab & kuis latihan tanpa batas",
      "Semua fitur evaluasi audio AI",
    ],
    cta: "Pilih Paket Gabungan",
  },
  {
    code: "pro",
    name: "Paket Pro",
    tier: "Akses Maksimal",
    price: "Rp 160.000",
    period: "/bulan",
    badge: "Tanpa Batas",
    isPopular: false,
    desc: "Kuota paling fleksibel untuk latihan intensif dan pembuatan materi profesional.",
    features: [
      "Simulasi Presentasi 40x / minggu",
      "Simulasi Wawancara 30x / minggu",
      "15 modul kursus per hari",
      "Akses tanpa batas semua fitur platform",
      "Dukungan prioritas 24/7",
    ],
    cta: "Pilih Paket Pro",
  },
];

const COURSE_PLANS: PlanOption[] = [
  {
    code: "premium",
    name: "Premium Course",
    tier: "Fokus Materi",
    price: "Rp 45.000",
    period: "/bulan",
    badge: "Paling Pas",
    isPopular: false,
    desc: "Susun silabus terarah, materi mendalam, rangkuman, dan kuis otomatis tanpa hambatan.",
    features: [
      "3 modul kursus per hari",
      "Bab & subbab bertingkat lengkap",
      "Kuis kustom dari file atau teks",
      "Latihan suara materi AI",
    ],
    cta: "Pilih Paket Course",
  },
  {
    code: "premium_gabungan",
    name: "Premium Gabungan",
    tier: "Terlengkap & Populer",
    price: "Rp 100.000",
    period: "/bulan",
    badge: "Paling Populer",
    isPopular: true,
    desc: "Generator kursus AI lengkap ditambah modul latihan simulasi presentasi & wawancara.",
    features: [
      "5 modul kursus per hari",
      "Simulasi Presentasi 15x / minggu",
      "Simulasi Wawancara 15x / minggu",
      "Bab & kuis latihan tanpa batas",
      "Semua fitur evaluasi audio AI",
    ],
    cta: "Pilih Paket Gabungan",
  },
  {
    code: "pro",
    name: "Paket Pro",
    tier: "Akses Maksimal",
    price: "Rp 160.000",
    period: "/bulan",
    badge: "Tanpa Batas",
    isPopular: false,
    desc: "Kuota tertinggi dan performa generasi prioritas untuk pembelajar serius.",
    features: [
      "15 modul kursus per hari",
      "Bab & kuis latihan tanpa batas",
      "Simulasi Presentasi 40x / minggu",
      "Simulasi Wawancara 30x / minggu",
      "Dukungan prioritas 24/7",
    ],
    cta: "Pilih Paket Pro",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Form State Slide 1
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [pendidikan, setPendidikan] = useState("Kuliah");
  const [jurusan, setJurusan] = useState("");
  const [institusi, setInstitusi] = useState("");
  const [levelBicara, setLevelBicara] = useState("pemula");

  // Form State Slide 2
  const [tujuan, setTujuan] = useState("keduanya");

  const [saving, setSaving] = useState(false);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Batas tanggal lahir hari ini
  const todayDateString = new Date().toISOString().split("T")[0];

  useEffect(() => {
    async function checkUser() {
      if (!supabaseConfigured) {
        setCheckingAuth(false);
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      // Ambil profile jika sudah ada data awal
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username, onboarding_completed, tanggal_lahir, pendidikan_saat_ini, jurusan, institusi, level_bicara, tujuan_user")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserName(profile.full_name || profile.username || "Teman Belajar");
        if (profile.tanggal_lahir) setTanggalLahir(profile.tanggal_lahir);
        if (profile.pendidikan_saat_ini) setPendidikan(profile.pendidikan_saat_ini);
        if (profile.jurusan) setJurusan(profile.jurusan);
        if (profile.institusi) setInstitusi(profile.institusi);
        if (profile.level_bicara) setLevelBicara(profile.level_bicara);
        if (profile.tujuan_user) setTujuan(profile.tujuan_user);
      }

      setCheckingAuth(false);
    }

    void checkUser();
  }, [router]);

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!tanggalLahir) {
      setError("Silakan isi tanggal lahir Anda.");
      return;
    }
    if (!jurusan.trim()) {
      setError("Silakan isi jurusan atau bidang keahlian Anda.");
      return;
    }

    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveOnboardingProfile(): Promise<boolean> {
    if (!userId) return false;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        tanggal_lahir: tanggalLahir || null,
        pendidikan_saat_ini: pendidikan,
        jurusan: jurusan.trim(),
        institusi: institusi.trim() || null,
        level_bicara: levelBicara,
        tujuan_user: tujuan,
        onboarding_completed: true,
      })
      .eq("id", userId);

    if (updErr) {
      console.error("Gagal menyimpan onboarding:", updErr);
      setError(updErr.message || "Terjadi kesalahan saat menyimpan data. Silakan coba lagi.");
      setSaving(false);
      setSelectedPlanCode(null);
      return false;
    }

    return true;
  }

  async function handleSelectPlan(planCode: string) {
    setSelectedPlanCode(planCode);
    const success = await saveOnboardingProfile();
    if (!success) return;

    router.push(`/pricing?plan=${planCode}`);
    router.refresh();
  }

  async function handleSkipToPortal() {
    setSelectedPlanCode("skip");
    const success = await saveOnboardingProfile();
    if (!success) return;

    router.push("/portal");
    router.refresh();
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f3f7] text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#283157] border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Memeriksa status akun…</p>
        </div>
      </div>
    );
  }

  const currentPlaceholder =
    PENDIDIKAN_OPTIONS.find((p) => p.id === pendidikan)?.placeholder ||
    "Contoh: Teknik Informatika / Manajemen";

  const activePlans = tujuan === "simulasi_presentasi" ? SIMULASI_PLANS : COURSE_PLANS;

  const currentFocusLabel =
    TUJUAN_OPTIONS.find((t) => t.id === tujuan)?.title || "Semua Fitur";

  return (
    <div className="min-h-screen bg-[#f2f3f7] text-[#272b3f] flex flex-col font-sans">
      {/* ── Top Header ────────────────────────────────────────── */}
      <header className="w-full border-b border-slate-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/images/logo.png"
              alt="Logo belajar.skuy"
              width={34}
              height={34}
              className="rounded-md transition group-hover:scale-105"
            />
            <span className="text-xl font-extrabold tracking-tight text-[#283157]">
              belajar.skuy
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 hover:text-[#283157] transition"
          >
            <i className="bi bi-house"></i>
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </header>

      {/* ── Main Container ────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-8">
        {/* Stepper Progress Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#283157]">
              Langkah {step} dari 3
            </p>
            <h2 className="text-sm font-semibold text-slate-500 mt-0.5">
              {step === 1 && "Profil Diri & Pendidikan"}
              {step === 2 && "Tentukan Fokus Utama Belajar"}
              {step === 3 && "Pilihan Paket Belajar & Latihan"}
            </h2>
          </div>

          <nav aria-label="Tahap onboarding" className="flex items-center gap-2">
            {[
              { num: 1, label: "Profil" },
              { num: 2, label: "Fokus" },
              { num: 3, label: "Paket" },
            ].map((st) => {
              const isActive = step === st.num;
              const isPassed = step > st.num;
              return (
                <button
                  key={st.num}
                  type="button"
                  disabled={st.num > step}
                  onClick={() => {
                    if (st.num < step) setStep(st.num as 1 | 2 | 3);
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                    isActive
                      ? "bg-[#283157] text-white shadow-sm"
                      : isPassed
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold">
                    {isPassed ? <i className="bi bi-check-lg"></i> : st.num}
                  </span>
                  <span>{st.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 2-Column Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Intro Panel (4 cols) */}
          <aside className="lg:col-span-4 rounded-3xl bg-[#283157] text-white p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden min-h-[360px] lg:min-h-[580px]">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold tracking-wide uppercase text-indigo-200">
                <i className="bi bi-stars"></i>
                Personalisasi Akun
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight">
                {step === 1 && "Mulai dari rasa penasaran."}
                {step === 2 && "Pilih arah belajarmu."}
                {step === 3 && "Ruang pas untuk bertumbuh."}
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100/80 leading-relaxed">
                {step === 1 && "Biar modul materi, kurasi referensi, dan simulasi bicara terasa pas dengan latar belakangmu."}
                {step === 2 && "Kamu bisa memilih fokus menyusun materi, latihan presentasi slide & wawancara, atau keduanya."}
                {step === 3 && "Mulai dari paket yang paling sesuai dengan ritmemu. Bisa tetap menggunakan akun Gratis!"}
              </p>
            </div>

            {/* 3D Illustration Canvas */}
            <div className="relative z-10 my-6 flex items-center justify-center">
              <div className="relative w-48 h-36 sm:w-56 sm:h-44">
                <Image
                  src={
                    step === 2
                      ? "/images/presentation-illustration.webp"
                      : "/images/study-illustration.webp"
                  }
                  alt="Ilustrasi Belajar 3D"
                  fill
                  className="object-contain animate-book-float drop-shadow-2xl"
                  priority
                />
              </div>
            </div>

            {/* Intro Footer */}
            <div className="relative z-10 pt-4 border-t border-white/15 flex items-center gap-2.5 text-xs text-indigo-200/90 font-medium">
              <i className="bi bi-journal-bookmark-fill text-indigo-300"></i>
              <span>Belajar paham. Berani tampil.</span>
            </div>
          </aside>

          {/* Right Form Panel (8 cols) */}
          <section className="lg:col-span-8 rounded-3xl bg-white border border-slate-200/80 p-6 sm:p-10 shadow-sm">
            {/* Error Notification Alert */}
            {error && (
              <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3 text-rose-800 text-xs sm:text-sm">
                <i className="bi bi-exclamation-triangle-fill text-base shrink-0 mt-0.5"></i>
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
            )}

            {/* ── STEP 1: PROFIL & PENDIDIKAN ─────────────────── */}
            {step === 1 && (
              <form onSubmit={handleNextStep} noValidate className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#283157]">
                    Kenalan dulu, skuy.
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Isi profil singkat untuk menyesuaikan gaya bahasa dan tingkat kerumitan materi.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Kolom bertanda <span className="text-rose-500 font-bold">*</span> wajib diisi.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Tanggal Lahir */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="tanggal-lahir"
                      className="block text-xs font-bold text-slate-700"
                    >
                      Tanggal Lahir <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="tanggal-lahir"
                      type="date"
                      required
                      max={todayDateString}
                      value={tanggalLahir}
                      onChange={(e) => setTanggalLahir(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#283157] focus:ring-2 focus:ring-[#283157]/10"
                    />
                    <p className="text-[11px] text-slate-400">
                      Untuk rekomendasi usia & gaya bahasa materi AI.
                    </p>
                  </div>

                  {/* Pendidikan */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="pendidikan"
                      className="block text-xs font-bold text-slate-700"
                    >
                      Pendidikan / Profesi Saat Ini <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="pendidikan"
                      value={pendidikan}
                      onChange={(e) => setPendidikan(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#283157] focus:ring-2 focus:ring-[#283157]/10"
                    >
                      {PENDIDIKAN_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">
                      Menentukan tingkat kedalaman kurikulum silabus.
                    </p>
                  </div>

                  {/* Jurusan / Keahlian */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label
                      htmlFor="jurusan"
                      className="block text-xs font-bold text-slate-700"
                    >
                      Jurusan / Bidang Keahlian <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="jurusan"
                      type="text"
                      required
                      maxLength={160}
                      placeholder={currentPlaceholder}
                      value={jurusan}
                      onChange={(e) => setJurusan(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#283157] focus:ring-2 focus:ring-[#283157]/10"
                    />
                  </div>

                  {/* Sekolah / Instansi */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label
                      htmlFor="institusi"
                      className="block text-xs font-bold text-slate-700"
                    >
                      Sekolah / Kampus / Instansi <span className="text-xs font-normal text-slate-400">(Opsional)</span>
                    </label>
                    <input
                      id="institusi"
                      type="text"
                      maxLength={180}
                      placeholder="Nama institusi atau tempat bekerja saat ini"
                      value={institusi}
                      onChange={(e) => setInstitusi(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#283157] focus:ring-2 focus:ring-[#283157]/10"
                    />
                  </div>
                </div>

                {/* Pengalaman Public Speaking */}
                <div className="pt-2 space-y-3">
                  <span className="block text-xs font-bold text-slate-700">
                    Pengalaman Presentasi & Berbicara di Depan Umum
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {LEVEL_BICARA_OPTIONS.map((lvl) => {
                      const isSelected = levelBicara === lvl.id;
                      return (
                        <label
                          key={lvl.id}
                          className={`relative flex flex-col p-4 rounded-2xl border cursor-pointer transition ${
                            isSelected
                              ? "border-[#283157] bg-[#283157]/5 shadow-sm"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-bold text-sm text-slate-800">
                              <i className={`bi ${lvl.icon} text-[#283157]`}></i>
                              {lvl.title}
                            </span>
                            <input
                              type="radio"
                              name="level_bicara"
                              value={lvl.id}
                              checked={isSelected}
                              onChange={() => setLevelBicara(lvl.id)}
                              className="accent-[#283157]"
                            />
                          </div>
                          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                            {lvl.subtitle}
                          </p>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Form Action */}
                <div className="pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-xs text-slate-400">
                    Data dapat diperbarui kapan saja di menu Pengaturan Akun.
                  </span>
                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#283157] hover:bg-[#1f2644] text-white px-7 py-3 text-sm font-bold shadow-md transition active:scale-95"
                  >
                    <span>Lanjut ke Fokus Belajar</span>
                    <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 2: FOKUS BELAJAR ────────────────────────── */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#283157]">
                    Tentukan fokus belajarmu.
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Pilih kapabilitas platform yang paling relevan dengan tujuanmu saat ini.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {TUJUAN_OPTIONS.map((opt) => {
                    const isSelected = tujuan === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={`relative flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition ${
                          isSelected
                            ? "border-[#283157] bg-[#283157]/5 shadow-sm"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-lg transition ${
                            isSelected
                              ? "bg-[#283157] text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <i className={`bi ${opt.icon}`}></i>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-slate-800">
                              {opt.title}
                            </span>
                            {opt.badge && (
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                            {opt.desc}
                          </p>
                        </div>

                        <input
                          type="radio"
                          name="tujuan"
                          value={opt.id}
                          checked={isSelected}
                          onChange={() => setTujuan(opt.id)}
                          className="mt-1 accent-[#283157]"
                        />
                      </label>
                    );
                  })}
                </div>

                {/* Navigation Actions */}
                <div className="pt-6 border-t border-slate-200/80 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    <i className="bi bi-arrow-left"></i>
                    <span>Kembali</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep(3);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#283157] hover:bg-[#1f2644] text-white px-7 py-3 text-sm font-bold shadow-md transition active:scale-95"
                  >
                    <span>Lanjut ke Pilihan Paket</span>
                    <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: PAKET BELAJAR ────────────────────────── */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Fokus:</span>
                    <span className="font-bold text-[#283157]">
                      {currentFocusLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="ml-2 text-indigo-600 hover:underline font-medium inline-flex items-center gap-1"
                    >
                      <i className="bi bi-pencil-square"></i>
                      <span>Ubah fokus</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSkipToPortal()}
                    disabled={saving}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1.5 transition self-start sm:self-auto"
                  >
                    <span>Mulai dengan Gratis</span>
                    <i className="bi bi-arrow-right"></i>
                  </button>
                </div>

                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#283157]">
                    Pilihan Paket Rekomendasi
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Paket di bawah disaring otomatis berdasarkan fokus belajarmu:
                  </p>
                </div>

                {/* Plan Recommendation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                  {activePlans.map((plan) => {
                    const isPopular = plan.isPopular;
                    const isSelected = selectedPlanCode === plan.code;

                    return (
                      <div
                        key={plan.code}
                        className={`relative rounded-3xl p-5 sm:p-6 flex flex-col justify-between border transition ${
                          isPopular
                            ? "bg-[#283157] text-white border-[#283157] shadow-lg"
                            : "bg-slate-50/70 border-slate-200 text-slate-800"
                        }`}
                      >
                        {plan.badge && (
                          <span
                            className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                              isPopular
                                ? "bg-amber-400 text-slate-900"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {plan.badge}
                          </span>
                        )}

                        <div>
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wider ${
                              isPopular ? "text-indigo-200" : "text-slate-400"
                            }`}
                          >
                            {plan.tier}
                          </span>
                          <h3 className="mt-1 text-lg font-extrabold">{plan.name}</h3>

                          <div className="mt-3 flex items-baseline gap-1">
                            <span className="text-2xl font-black tracking-tight">
                              {plan.price}
                            </span>
                            <span
                              className={`text-xs ${
                                isPopular ? "text-indigo-200" : "text-slate-400"
                              }`}
                            >
                              {plan.period}
                            </span>
                          </div>

                          <p
                            className={`mt-2 text-xs leading-relaxed min-h-[36px] ${
                              isPopular ? "text-indigo-100/90" : "text-slate-500"
                            }`}
                          >
                            {plan.desc}
                          </p>

                          <div
                            className={`my-4 border-t ${
                              isPopular ? "border-white/15" : "border-slate-200"
                            }`}
                          />

                          <ul className="space-y-2">
                            {plan.features.map((feat, fIdx) => (
                              <li key={fIdx} className="flex items-start gap-2 text-xs leading-relaxed">
                                <i
                                  className={`bi bi-check-circle-fill text-sm shrink-0 mt-0.5 ${
                                    isPopular ? "text-emerald-300" : "text-[#283157]"
                                  }`}
                                ></i>
                                <span className={isPopular ? "text-white/90" : "text-slate-600"}>
                                  {feat}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-6 mt-auto">
                          <button
                            type="button"
                            onClick={() => void handleSelectPlan(plan.code)}
                            disabled={saving}
                            className={`w-full rounded-2xl py-3 px-4 text-xs font-bold transition active:scale-95 flex items-center justify-center gap-2 shadow-sm ${
                              isPopular
                                ? "bg-white text-[#283157] hover:bg-slate-100"
                                : "bg-[#283157] text-white hover:bg-[#1f2644]"
                            } disabled:opacity-60`}
                          >
                            {isSelected && saving ? (
                              <>
                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                <span>Menyiapkan…</span>
                              </>
                            ) : (
                              <>
                                <span>{plan.cta}</span>
                                <i className="bi bi-cart-check-fill"></i>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Actions */}
                <div className="pt-6 border-t border-slate-200/80 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={saving}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    <i className="bi bi-arrow-left"></i>
                    <span>Kembali ke Fokus</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSkipToPortal()}
                    disabled={saving}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 px-6 py-3 text-xs sm:text-sm font-bold transition active:scale-95 disabled:opacity-50"
                  >
                    {selectedPlanCode === "skip" && saving ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span>Membuka Portal…</span>
                      </>
                    ) : (
                      <>
                        <span>Lewati, buka Portal</span>
                        <i className="bi bi-arrow-right"></i>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-center text-xs text-slate-400 pt-1 flex items-center justify-center gap-1.5">
                  <i className="bi bi-info-circle-fill"></i>
                  <span>
                    Bisa mulai dengan paket Gratis dan upgrade kapan saja di menu Harga.
                  </span>
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
