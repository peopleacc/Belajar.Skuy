"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

const PENDIDIKAN_OPTIONS = [
  { id: "SD", label: "SD / Sederajat" },
  { id: "SMP", label: "SMP / MTs" },
  { id: "SMA/SMK", label: "SMA / SMK / MA" },
  { id: "Kuliah", label: "Perguruan Tinggi (D3/S1)" },
  { id: "Magister", label: "Pascasarjana (S2/S3)" },
  { id: "Kerja", label: "Profesional / Bekerja" },
  { id: "Lainnya", label: "Lainnya" },
];

const LEVEL_BICARA_OPTIONS = [
  { id: "pemula", label: "🌱 Pemula", desc: "Baru mulai, butuh motivasi" },
  { id: "menengah", label: "🌿 Menengah", desc: "Cukup percaya diri, poles tempo & kontak mata" },
  { id: "mahir", label: "🌳 Mahir", desc: "Berpengalaman, standar eksekutif" },
];

const TUJUAN_OPTIONS = [
  { id: "generate_course", label: "📚 Buat & Pelajari Kursus AI" },
  { id: "simulasi_presentasi", label: "🎙️ Simulasi Presentasi & Wawancara" },
  { id: "keduanya", label: "🚀 Keduanya (Semua Fitur)" },
];

export default function EditProfileForm({
  userId,
  initialFullName,
  initialUsername,
  initialAvatarUrl,
  initialTanggalLahir = "",
  initialPendidikan = "Kuliah",
  initialJurusan = "",
  initialInstitusi = "",
  initialLevelBicara = "pemula",
  initialTujuanUser = "keduanya",
}: {
  userId: string;
  initialFullName: string;
  initialUsername: string;
  initialAvatarUrl: string;
  initialTanggalLahir?: string;
  initialPendidikan?: string;
  initialJurusan?: string;
  initialInstitusi?: string;
  initialLevelBicara?: string;
  initialTujuanUser?: string;
}) {
  const router = useRouter();

  // Basic Profile State
  const [fullName, setFullName] = useState(initialFullName);
  const [username, setUsername] = useState(initialUsername);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  // Academic & Onboarding State
  const [tanggalLahir, setTanggalLahir] = useState(initialTanggalLahir);
  const [pendidikan, setPendidikan] = useState(initialPendidikan || "Kuliah");
  const [jurusan, setJurusan] = useState(initialJurusan);
  const [institusi, setInstitusi] = useState(initialInstitusi);
  const [levelBicara, setLevelBicara] = useState(initialLevelBicara || "pemula");
  const [tujuanUser, setTujuanUser] = useState(initialTujuanUser || "keduanya");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    if (username.trim().length < 3) {
      setError("Username minimal 3 karakter.");
      return;
    }
    if (!supabaseConfigured) {
      setError("Supabase belum dikonfigurasi.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        username: username.trim(),
        avatar_url: avatarUrl.trim() || null,
        tanggal_lahir: tanggalLahir || null,
        pendidikan_saat_ini: pendidikan || null,
        jurusan: jurusan.trim() || null,
        institusi: institusi.trim() || null,
        level_bicara: levelBicara || "pemula",
        tujuan_user: tujuanUser || "keduanya",
      })
      .eq("id", userId);

    setSaving(false);

    if (updErr) {
      if (updErr.code === "23505" || /duplicate|unique/i.test(updErr.message)) {
        setError("Username itu sudah dipakai orang lain — coba yang lain.");
      } else {
        setError("Gagal menyimpan profil. Coba lagi ya.");
      }
      return;
    }

    setOk(true);
    router.refresh();
  }

  const preview = avatarUrl.trim();
  const initials = (fullName || username || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const inputCls =
    "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Kartu 1: Identitas Dasar */}
      <div className="rounded-xl border border-slate-200 bg-surface p-6 shadow-card md:p-8">
        <div className="mb-6 flex items-center gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Avatar"
              className="h-16 w-16 rounded-2xl object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-white">
              {initials}
            </span>
          )}
          <div>
            <p className="font-bold text-slate-800">{fullName || "Tanpa nama"}</p>
            <p className="text-sm text-slate-400">@{username}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Nama Lengkap</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nama tampilanmu"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">URL Avatar (opsional)</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-slate-400">Tempel URL gambar profil.</p>
          </div>
        </div>
      </div>

      {/* Kartu 2: Informasi Akademik & Preferensi Belajar (Onboarding Data) */}
      <div className="rounded-xl border border-slate-200 bg-surface p-6 shadow-card md:p-8">
        <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-base">
            🎓
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Informasi Akademik &amp; Preferensi Belajar</h2>
            <p className="text-xs text-slate-400">Data ini digunakan untuk personalisasi materi dan evaluasi AI.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Tanggal Lahir</label>
              <input
                type="date"
                value={tanggalLahir}
                onChange={(e) => setTanggalLahir(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Pendidikan / Status</label>
              <select
                value={pendidikan}
                onChange={(e) => setPendidikan(e.target.value)}
                className={inputCls}
              >
                {PENDIDIKAN_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Jurusan / Keahlian</label>
              <input
                type="text"
                value={jurusan}
                onChange={(e) => setJurusan(e.target.value)}
                placeholder="Contoh: Teknik Informatika / Manajemen"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nama Sekolah / Kampus / Instansi</label>
              <input
                type="text"
                value={institusi}
                onChange={(e) => setInstitusi(e.target.value)}
                placeholder="Contoh: Universitas Indonesia"
                className={inputCls}
              />
            </div>
          </div>

          {/* Level Public Speaking */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600">
              Pengalaman Public Speaking
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {LEVEL_BICARA_OPTIONS.map((lvl) => {
                const isSelected = levelBicara === lvl.id;
                return (
                  <div
                    key={lvl.id}
                    onClick={() => setLevelBicara(lvl.id)}
                    className={`cursor-pointer rounded-xl border p-3 text-xs transition ${
                      isSelected
                        ? "border-brand-500 bg-brand-50/70 font-semibold text-brand-700 ring-1 ring-brand-500"
                        : "border-border bg-surface text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-bold">{lvl.label}</p>
                    <p className="mt-0.5 text-[11px] font-normal text-slate-500">{lvl.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tujuan Pengguna */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600">
              Fokus Utama Penggunaan
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {TUJUAN_OPTIONS.map((t) => {
                const isSelected = (tujuanUser || "keduanya") === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setTujuanUser(t.id)}
                    className={`cursor-pointer rounded-xl border p-3 text-xs transition ${
                      isSelected
                        ? "border-brand-500 bg-brand-50/70 font-bold text-brand-700 ring-1 ring-brand-500"
                        : "border-border bg-surface text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
      {ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-600">
          ✓ Seluruh informasi profil dan preferensi berhasil disimpan.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 disabled:opacity-60"
        >
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}
