"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

// Fitur C — edit profil: simpan full_name / username / avatar_url ke tabel profiles
// (RLS "update own profile" sudah ada). Tangani bentrok username dengan pesan ramah.
export default function EditProfileForm({
  userId,
  initialFullName,
  initialUsername,
  initialAvatarUrl,
}: {
  userId: string;
  initialFullName: string;
  initialUsername: string;
  initialAvatarUrl: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [username, setUsername] = useState(initialUsername);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
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
    router.refresh(); // segarkan navbar & data profil
  }

  const preview = avatarUrl.trim();
  const initials = (fullName || username || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <form onSubmit={handleSubmit} className="rounded-sm bg-surface p-6 shadow-card md:p-8">
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
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">URL Avatar (opsional)</label>
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-brand-100"
          />
          <p className="mt-1 text-[11px] text-slate-400">Tempel URL gambar (upload file menyusul).</p>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
      {ok && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-600">
          ✓ Profil tersimpan.
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-6 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 disabled:opacity-60"
      >
        {saving ? "Menyimpan..." : "Simpan Perubahan"}
      </button>
    </form>
  );
}
