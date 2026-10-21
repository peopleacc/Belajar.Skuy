"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

const PENDIDIKAN_OPTIONS = [
  { id: "SD", label: "SD / Sederajat", icon: "🎒" },
  { id: "SMP", label: "SMP / MTs", icon: "📐" },
  { id: "SMA/SMK", label: "SMA / SMK / MA", icon: "🏫" },
  { id: "Kuliah", label: "Perguruan Tinggi (D3/S1)", icon: "🎓" },
  { id: "Magister", label: "Pascasarjana (S2/S3)", icon: "🏛️" },
  { id: "Kerja", label: "Profesional / Bekerja", icon: "💼" },
];

const LEVEL_BICARA_OPTIONS = [
  {
    id: "pemula",
    title: "Pemula (Beginner)",
    desc: "Baru mulai belajar public speaking, butuh evaluasi ramah & banyak motivasi.",
    badge: "🌱 Pemula",
  },
  {
    id: "menengah",
    title: "Menengah (Intermediate)",
    desc: "Cukup percaya diri, ingin memoles kestabilan tempo, kontak mata, dan diksi.",
    badge: "🌿 Menengah",
  },
  {
    id: "mahir",
    title: "Mahir (Advanced)",
    desc: "Sudah sering berbicara di depan umum, menargetkan standar panggung eksekutif.",
    badge: "🌳 Mahir",
  },
];

const TUJUAN_OPTIONS = [
  {
    id: "generate_course",
    title: "Buat & Pelajari Kursus AI",
    desc: "Ingin generate materi kursus interaktif, modul silabus terstruktur, dan kuis pemahaman pintar.",
    icon: "📚",
    badge: "Arahkan ke Dashboard Kursus",
    dest: "/dashboard",
  },
  {
    id: "simulasi_presentasi",
    title: "Simulasi Presentasi & Wawancara",
    desc: "Ingin melatih public speaking presentasi slide PPT atau persiapan interview kerja dengan AI co-pilot.",
    icon: "🎙️",
    badge: "Arahkan ke Studio Simulasi",
    dest: "/simulation",
  },
  {
    id: "keduanya",
    title: "Eksplorasi Semua Fitur Platform",
    desc: "Ingin menggunakan generator kursus sekaligus latihan simulasi presentasi dan interview.",
    icon: "🚀",
    badge: "Arahkan ke Portal Utama",
    dest: "/portal",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
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
  const [error, setError] = useState<string | null>(null);

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

  async function handleCompleteOnboarding() {
    if (!userId) return;
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
      setError("Terjadi kesalahan saat menyimpan data. Silakan coba lagi.");
      setSaving(false);
      return;
    }

    // Arahkan sesuai tujuan yang dipilih
    const selected = TUJUAN_OPTIONS.find((t) => t.id === tujuan);
    const dest = selected?.dest || "/portal";

    router.push(dest);
    router.refresh();
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Memeriksa status akun…</p>
        </div>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <main className="min-h-screen bg-slate-900 py-10 px-4 [background-image:radial-gradient(circle,#2a2547_1px,transparent_1px)] [background-size:24px_24px] flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl p-6 sm:p-10 border border-slate-100">
        {/* Progress Bar & Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span className="flex items-center gap-1.5 text-brand-600 font-bold">
              <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
              Langkah {step} dari 2
            </span>
            <span>{step === 1 ? "Informasi Diri & Pendidikan" : "Tujuan Bergabung"}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-indigo-600 transition-all duration-300 rounded-full"
              style={{ width: step === 1 ? "50%" : "100%" }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-rose-50 p-4 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* SLIDE 1: IDENTITAS & PENDIDIKAN                                */}
        {/* ============================================================== */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="space-y-6">
            <div>
              <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600 mb-2">
                🎓 Profil Pembelajar
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                Halo, {userName || "Teman Belajar"}! Mari Berkenalan
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Lengkapi latar belakang pendidikan dan gaya bicaramu agar platform dapat menyesuaikan tingkat kesulitan materi dan rekomendasi evaluasi AI.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {/* Tanggal Lahir */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Tanggal Lahir <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={tanggalLahir}
                  onChange={(e) => setTanggalLahir(e.target.value)}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Digunakan untuk memastikan usia dan penyesuaian gaya bahasa materi.
                </p>
              </div>

              {/* Pendidikan Saat Ini (Pills) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Pendidikan / Profesi Saat Ini <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {PENDIDIKAN_OPTIONS.map((opt) => {
                    const isSelected = pendidikan === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPendidikan(opt.id)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-left text-xs font-medium transition ${
                          isSelected
                            ? "border-brand-500 bg-brand-50 text-brand-700 font-bold shadow-sm ring-1 ring-brand-500"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-base">{opt.icon}</span>
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Jurusan / Keahlian */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Jurusan / Program Studi / Bidang Keahlian <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={jurusan}
                  onChange={(e) => setJurusan(e.target.value)}
                  placeholder={
                    pendidikan === "SD" || pendidikan === "SMP"
                      ? "Contoh: Umum / Kurikulum Merdeka"
                      : pendidikan === "SMA/SMK"
                      ? "Contoh: IPA / IPS / Rekayasa Perangkat Lunak"
                      : pendidikan === "Kerja"
                      ? "Contoh: Software Engineering / Marketing / Keuangan"
                      : "Contoh: Teknik Informatika / Manajemen Bisnis / Kedokteran"
                  }
                  className={inputCls}
                />
              </div>

              {/* Institusi / Sekolah (Opsional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nama Sekolah / Kampus / Instansi Kerja <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={institusi}
                  onChange={(e) => setInstitusi(e.target.value)}
                  placeholder="Contoh: Universitas Indonesia, SMAN 1 Jakarta, PT Mandiri"
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Akan ditampilkan pada sertifikat kursus dan laporan hasil evaluasi simulasi.
                </p>
              </div>

              {/* Level Jam Terbang Public Speaking */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Pengalaman Public Speaking / Presentasi
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {LEVEL_BICARA_OPTIONS.map((lvl) => {
                    const isSelected = levelBicara === lvl.id;
                    return (
                      <div
                        key={lvl.id}
                        onClick={() => setLevelBicara(lvl.id)}
                        className={`cursor-pointer rounded-xl border p-3 transition flex flex-col justify-between ${
                          isSelected
                            ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">{lvl.badge}</p>
                          <p className="mt-1 text-[11px] leading-tight text-slate-500">{lvl.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto rounded-xl bg-brand-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95"
              >
                Lanjut ke Tujuan Belajar →
              </button>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* SLIDE 2: TUJUAN UTAMA BERGABUNG                                */}
        {/* ============================================================== */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 mb-2">
                🎯 Personalisasi Pengalaman
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                Apa Fokus Utama Kamu di Platform Ini?
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Pilih tujuan utamamu agar kami dapat langsung mengarahkanmu ke ruang belajar yang paling tepat.
              </p>
            </div>

            <div className="space-y-3.5 pt-2">
              {TUJUAN_OPTIONS.map((opt) => {
                const isSelected = tujuan === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setTujuan(opt.id)}
                    className={`cursor-pointer rounded-xl border p-4 sm:p-5 transition flex items-start gap-4 ${
                      isSelected
                        ? "border-brand-500 bg-brand-50/70 shadow-sm ring-1 ring-brand-500"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm border border-slate-100">
                      {opt.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-800">{opt.title}</p>
                        <span className="rounded-full bg-brand-100/80 px-2.5 py-0.5 text-[10px] font-semibold text-brand-700">
                          {opt.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">{opt.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={saving}
                className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                ← Kembali ke Data Diri
              </button>

              <button
                type="button"
                onClick={() => void handleCompleteOnboarding()}
                disabled={saving}
                className="w-full sm:w-auto rounded-xl bg-brand-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
              >
                {saving ? "Menyimpan Data…" : "Selesaikan & Mulai Belajar 🚀"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
