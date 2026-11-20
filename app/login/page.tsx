"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import BrandLogo from "@/components/BrandLogo";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { recordLogin } from "@/lib/loginEvents";
import { getAppUrl, sanitizeInternalUrl } from "@/lib/url";

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
  const [showPassword, setShowPassword] = useState(false);
  const rawError = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    rawError === "account_not_found"
      ? null
      : rawError
      ? "Login gagal, silakan coba lagi."
      : null
  );
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Task 15A-AS: Sanitasi parameter redirect 'next' (Anti-Open-Redirect & Anti-XSS)
  const nextTarget = sanitizeInternalUrl(searchParams.get("next"), "/portal");

  // Periksa lockout anti brute-force saat mount
  useEffect(() => {
    try {
      const lockUntil = Number(sessionStorage.getItem("auth_login_lockout") || "0");
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      if (remaining > 0) {
        setLockoutSeconds(remaining);
      }
    } catch {}
  }, []);

  // Timer countdown untuk lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          try {
            sessionStorage.removeItem("auth_login_lockout");
            sessionStorage.removeItem("auth_login_fails");
          } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Redirect otomatis jika sesi sudah aktif
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
    if (!supabaseConfigured || loading || lockoutSeconds > 0) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Silakan masukkan email dan password Anda.");
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      let fails = 0;
      try {
        fails = Number(sessionStorage.getItem("auth_login_fails") || "0") + 1;
        sessionStorage.setItem("auth_login_fails", String(fails));
      } catch {}

      // Jika gagal 4 kali, kunci 60 detik (Silent Counter Task 5A-SL)
      if (fails >= 4) {
        const lockUntil = Date.now() + 60000;
        try {
          sessionStorage.setItem("auth_login_lockout", String(lockUntil));
        } catch {}
        setLockoutSeconds(60);
        setError("Terlalu banyak percobaan gagal. Akun dikunci sementara selama 60 detik.");
      } else {
        if (error.message.includes("Invalid login credentials")) {
          setError("Email atau kata sandi tidak sesuai.");
        } else if (error.status === 429 || /rate|limit/i.test(error.message)) {
          setError("Terlalu banyak permintaan ke server. Silakan tunggu beberapa saat.");
        } else {
          setError(error.message);
        }
      }

      setLoading(false);
      return;
    }

    // Reset counter gagal saat login berhasil
    try {
      sessionStorage.removeItem("auth_login_fails");
      sessionStorage.removeItem("auth_login_lockout");
    } catch {}

    if (data.user) await recordLogin(supabase, data.user.id);
    router.push(nextTarget);
    router.refresh();
  }

  async function signInWithGoogle() {
    if (!supabaseConfigured || loading || lockoutSeconds > 0) return;
    const supabase = createClient();
    const origin = getAppUrl();
    const redirectUrl = `${origin}/auth/callback?flow=signin&next=${encodeURIComponent(nextTarget)}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });
  }

  const isAccountNotFound = rawError === "account_not_found";

  return (
    <div className="w-full max-w-md">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Masuk, skuy.
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Lanjutkan perjalanan belajarmu di ruang belajar terpadu.
        </p>
      </div>

      {/* Banner Khusus: Akun Google Belum Terdaftar */}
      {isAccountNotFound && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <i className="bi bi-exclamation-triangle-fill text-amber-600"></i>
            <span>Akun Google Belum Terdaftar</span>
          </div>
          <p className="mt-1.5 leading-relaxed text-slate-600">
            Akun Google yang Anda pilih belum terdaftar di <strong>belajar.skuy</strong>. Silakan lakukan pendaftaran terlebih dahulu.
          </p>
          <div className="mt-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-1.5 font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95"
            >
              <span>Daftar Akun Baru Sekarang</span>
              <i className="bi bi-arrow-right text-[11px]"></i>
            </Link>
          </div>
        </div>
      )}

      {/* Banner Lockout Brute-Force */}
      {lockoutSeconds > 0 && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-sm">
          <p className="flex items-center gap-2 font-bold text-rose-900">
            <i className="bi bi-hourglass-split text-rose-600"></i>
            <span>Formulir Terkunci Sementara</span>
          </p>
          <p className="mt-1 leading-relaxed">
            Terlalu banyak percobaan gagal. Silakan tunggu{" "}
            <span className="font-mono font-bold text-rose-900">
              {String(Math.floor(lockoutSeconds / 60)).padStart(2, "0")}:
              {String(lockoutSeconds % 60).padStart(2, "0")}
            </span>{" "}
            sebelum mencoba kembali.
          </p>
        </div>
      )}

      {!supabaseConfigured && (
        <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Supabase belum dikonfigurasi — isi <code className="font-mono">next/.env.local</code> lalu restart dev server.
        </div>
      )}

      {/* Google OAuth Button */}
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={!supabaseConfigured || loading || lockoutSeconds > 0}
        className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border/90 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-surface-2 active:scale-[0.99] disabled:opacity-50"
      >
        <GoogleIcon />
        <span>Masuk dengan Google</span>
      </button>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-400">
        <div className="h-px flex-1 bg-border/80" />
        <span>atau lewat email</span>
        <div className="h-px flex-1 bg-border/80" />
      </div>

      {/* Email Password Form */}
      <form onSubmit={signInWithEmail} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700">
            Email
          </label>
          <input
            type="email"
            required
            disabled={lockoutSeconds > 0}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@contoh.com"
            className="h-12 w-full rounded-2xl border border-border/90 bg-surface-2 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700">
              Kata Sandi
            </label>
            <span className="text-xs font-semibold text-slate-400 hover:text-brand-500 cursor-pointer">
              Lupa kata sandi?
            </span>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              disabled={lockoutSeconds > 0}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Kata sandi akunmu"
              className="h-12 w-full rounded-2xl border border-border/90 bg-surface-2 pr-12 pl-4 text-sm font-medium text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100 disabled:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"
            >
              <i className={`bi ${showPassword ? "bi-eye-slash-fill" : "bi-eye-fill"} text-base`}></i>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 flex items-center gap-2">
            <i className="bi bi-x-circle-fill"></i>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !supabaseConfigured || lockoutSeconds > 0}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-all duration-200 hover:bg-brand-600 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? (
            <span>Memproses...</span>
          ) : lockoutSeconds > 0 ? (
            <span>Tunggu ({lockoutSeconds}s)</span>
          ) : (
            <>
              <span>Masuk ke Akun</span>
              <i className="bi bi-arrow-right text-xs"></i>
            </>
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-slate-500">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="font-bold text-brand-500 hover:underline underline-offset-4"
        >
          Buat akun baru
        </Link>
      </p>
    </div>
  );
}

/**
 * Halaman Login Dua-Kolom (Planning 8 - Task 8D-AU)
 * Mengadopsi arsitektur 2-kolom auth shell dari Redesign/login.html.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-dominant text-slate-800 transition-colors duration-300 flex flex-col justify-between">
      {/* Top Header Bar */}
      <header className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 md:px-10">
        <Link href="/" className="group flex items-center gap-2.5">
          <BrandLogo
            size="md"
            variant="dark"
            className="rounded-xl shadow-md transition-transform duration-200 group-hover:scale-105 ring-1 ring-white/10"
            priority
          />
          <span className="text-xl font-extrabold tracking-[-0.06em] text-slate-900">
            belajar<span className="text-brand-500">.skuy</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-brand-500"
          >
            <i className="bi bi-arrow-left text-sm"></i>
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </header>

      {/* Main 2-Column Shell */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 md:px-10">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border/80 bg-white shadow-2xl transition-colors duration-300 lg:grid-cols-12 min-h-[580px]">
          {/* Kolom Kiri: Visual Story & 3D Illustration */}
          <div className="relative flex flex-col justify-between bg-surface-2 p-8 lg:col-span-5 sm:p-10">
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
                Langkah Kecil
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                Makin paham.
                <br />
                Makin percaya diri.
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs">
                Materi, kuis, dan latihan AI siap menemani setiap langkah eksplorasimu.
              </p>
            </div>

            <div className="relative my-8 flex items-center justify-center">
              <Image
                src="/images/presentation-illustration.webp"
                alt="Ilustrasi belajar 3D"
                width={720}
                height={540}
                className="animate-book-float-slow h-auto max-h-[260px] w-auto object-contain drop-shadow-xl"
              />
            </div>

            <div className="flex items-center justify-between border-t border-border/70 pt-4 text-xs font-semibold text-slate-500">
              <span>Belajar paham. Berani tampil.</span>
              <i className="bi bi-journal-bookmark-fill text-brand-500 text-sm"></i>
            </div>
          </div>

          {/* Kolom Kanan: Form Login */}
          <div className="flex items-center justify-center p-8 sm:p-12 lg:col-span-7">
            <Suspense fallback={<div className="text-xs text-slate-400">Memuat formulir...</div>}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>

      {/* Footer Minimalis */}
      <footer className="py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} belajar.skuy • Semua hak dilindungi.
      </footer>
    </div>
  );
}
