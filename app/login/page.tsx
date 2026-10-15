"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { recordLogin } from "@/lib/loginEvents";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") ? "Login gagal, silakan coba lagi." : null
  );
  const [loading, setLoading] = useState(false);

  // Target redirect default adalah /portal
  const nextTarget = searchParams.get("next") || "/portal";

  // Tangani redirect otomatis jika sesi sudah aktif (misal setelah OAuth Google kembali)
  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.push(nextTarget);
        router.refresh();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        router.push(nextTarget);
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router, nextTarget]);

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.user) await recordLogin(supabase, data.user.id); // Fitur DM
    // Fitur DI — mendarat di /portal, bukan /dashboard: sekarang ada DUA mode
    // (course & simulasi), jadi user memilih dulu, tidak diasumsikan.
    router.push(nextTarget);
    router.refresh();
  }

  async function signInWithGoogle() {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    // Arahkan callback ke /auth/callback dengan next=/portal eksplisit
    const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextTarget)}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });
  }

  return (
    <div className="w-full max-w-sm">
      {/* Backlink ke Landing Page (Poin 5) */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-brand-500"
      >
        <i className="bi bi-arrow-left text-sm"></i>
        Kembali ke Beranda
      </Link>

      <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
      <p className="mt-1 text-sm text-slate-500">
        Masuk untuk melanjutkan perjalanan belajarmu.
      </p>

      {!supabaseConfigured && (
        <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Supabase belum dikonfigurasi — isi{" "}
          <code className="font-mono">next/.env.local</code> lalu restart dev server.
        </div>
      )}

      <button
        onClick={signInWithGoogle}
        disabled={!supabaseConfigured}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        <GoogleIcon />
        Masuk dengan Google
      </button>

      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        atau lewat email
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={signInWithEmail} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@contoh.com"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-600">Password</label>
            <span className="cursor-pointer text-xs font-medium text-brand-500 hover:underline">
              Lupa password?
            </span>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !supabaseConfigured}
          className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 disabled:opacity-60"
        >
          {loading ? "Memproses..." : "Sign In →"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        Belum punya akun?{" "}
        <Link href="/register" className="font-semibold text-brand-500 hover:underline">
          Buat akun
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 p-6 [background-image:radial-gradient(circle,#2a2547_1px,transparent_1px)] [background-size:24px_24px]">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-sm bg-white shadow-2xl md:grid-cols-[1.1fr_1fr]">
        {/* Panel kiri gelap dengan logo buku besar (Poin 1 & 4) */}
        <div className="relative hidden flex-col items-center justify-center bg-gradient-to-b from-ink-800 to-ink-900 p-10 md:flex">
          <Link
            href="/"
            title="Kembali ke Beranda"
            className="group flex flex-col items-center text-center transition"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-ink-900 shadow-xl shadow-blue-500/10 ring-1 ring-white/20 transition duration-300 group-hover:scale-105 group-hover:bg-white/95">
              <i className="bi bi-book text-2xl"></i>
            </div>
            <h3 className="mt-6 text-2xl font-bold tracking-tight">
              <span className="text-white">belajar</span>
              <span className="text-white">.skuy</span>
            </h3>
            <p className="mt-2 max-w-xs text-xs text-light-muted">
              Platform Edukasi AI & Simulasi Terintegrasi
            </p>
          </Link>

          <p className="absolute bottom-6 text-xs text-light-muted">
            <span className="text-white">belajar</span>
            <span className="text-white">.skuy</span> © 2026
          </p>
        </div>

        {/* Panel kanan form */}
        <div className="flex items-center justify-center p-8 md:p-12">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
