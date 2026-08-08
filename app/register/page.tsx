"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { recordLogin } from "@/lib/loginEvents";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    // username dikirim via metadata → trigger handle_new_user() yang insert ke profiles
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, full_name: fullName },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      if (data.user) await recordLogin(supabase, data.user.id); // Fitur DM
      // Fitur DI — sama seperti login: pilih mode dulu di /portal.
      router.push("/portal");
      router.refresh();
    } else {
      setInfo("Pendaftaran berhasil! Cek email Anda untuk konfirmasi, lalu login.");
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 p-6 [background-image:radial-gradient(circle,#2a2547_1px,transparent_1px)] [background-size:24px_24px]">
      <div className="w-full max-w-md rounded-sm bg-white p-8 shadow-2xl md:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-white">
            ✦
          </div>
          <div>
            <h1 className="text-xl font-bold">
              Buat Akun <span className="text-brand-500">belajar.skuy</span>
            </h1>
            <p className="text-xs text-slate-500">Gratis, langsung bisa generate materi.</p>
          </div>
        </div>

        {!supabaseConfigured && (
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700">
            Supabase belum dikonfigurasi — isi{" "}
            <code className="font-mono">next/.env.local</code> lalu restart dev server.
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Username</label>
            <input
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
              placeholder="belajarskuy_user"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Nama Lengkap
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nama Anda"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@contoh.com"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className={inputCls}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
          )}
          {info && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{info}</p>
          )}

          <button
            type="submit"
            disabled={loading || !supabaseConfigured}
            className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? "Mendaftarkan..." : "Daftar →"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-semibold text-brand-500 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
