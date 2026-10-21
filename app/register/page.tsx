"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { recordLogin } from "@/lib/loginEvents";
import { getAppUrl } from "@/lib/url";

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

// Fungsi Evaluasi Skor Kekuatan Password (Standar OWASP — Zero Dependencies)
function evaluatePasswordStrength(pass: string) {
  const hasLength = pass.length >= 8;
  const hasUpperLower = /[a-z]/.test(pass) && /[A-Z]/.test(pass);
  const hasNumber = /\d/.test(pass);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pass);
  const hasNumberOrSymbol = hasNumber || hasSymbol;

  let score = 0;
  if (hasLength) score++;
  if (hasUpperLower) score++;
  if (hasNumber) score++;
  if (hasSymbol) score++;

  if (!pass) {
    return {
      score: 0,
      level: "empty",
      label: "",
      color: "bg-slate-200",
      barWidth: "0%",
      hasLength: false,
      hasUpperLower: false,
      hasNumberOrSymbol: false,
    };
  }

  if (score <= 1 || pass.length < 8) {
    return {
      score,
      level: "weak",
      label: "Lemah",
      color: "bg-rose-500",
      barWidth: "33%",
      hasLength,
      hasUpperLower,
      hasNumberOrSymbol,
    };
  }

  if (score <= 3) {
    return {
      score,
      level: "medium",
      label: "Sedang",
      color: "bg-amber-500",
      barWidth: "66%",
      hasLength,
      hasUpperLower,
      hasNumberOrSymbol,
    };
  }

  return {
    score,
    level: "strong",
    label: "Kuat & Aman",
    color: "bg-emerald-500",
    barWidth: "100%",
    hasLength,
    hasUpperLower,
    hasNumberOrSymbol,
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  const strength = evaluatePasswordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // Cek lockout anti spam/brute-force saat mount
  useEffect(() => {
    try {
      const lockUntil = Number(sessionStorage.getItem("auth_register_lockout") || "0");
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      if (remaining > 0) {
        setLockoutSeconds(remaining);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          try {
            sessionStorage.removeItem("auth_register_lockout");
            sessionStorage.removeItem("auth_register_fails");
          } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Handler Pendaftaran via Google OAuth (flow=signup)
  async function signUpWithGoogle() {
    if (!supabaseConfigured || loading || lockoutSeconds > 0) return;
    const supabase = createClient();
    const origin = getAppUrl();
    // Parameter flow=signup menandakan pendaftaran akun baru yang sah menuju onboarding
    const redirectUrl = `${origin}/auth/callback?flow=signup&next=/onboarding`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });
  }

  // Handler Pendaftaran Manual Email & Password
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured || loading || lockoutSeconds > 0) return;
    setError(null);
    setInfo(null);

    // 1. Sanitasi & Validasi Username
    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, "_");
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      setError(
        "Username hanya boleh terdiri dari 3–30 karakter berupa huruf kecil, angka, dan garis bawah (_)."
      );
      return;
    }

    // 2. Validasi Nama Lengkap
    const cleanFullName = fullName.trim();
    if (cleanFullName.length < 2) {
      setError("Nama lengkap minimal 2 karakter.");
      return;
    }

    // 3. Validasi Format Email RFC 5322
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Format email tidak valid (contoh: nama@domain.com).");
      return;
    }

    // 4. Validasi Kekuatan Password (OWASP Minimal 8 Karakter)
    if (password.length < 8) {
      setError("Password minimal 8 karakter demi keamanan akun Anda.");
      return;
    }

    // 5. Validasi Kecocokan Konfirmasi Password
    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok dengan password yang dimasukkan.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { username: cleanUsername, full_name: cleanFullName },
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
      },
    });

    if (signUpError) {
      let fails = 0;
      try {
        fails = Number(sessionStorage.getItem("auth_register_fails") || "0") + 1;
        sessionStorage.setItem("auth_register_fails", String(fails));
      } catch {}

      // Jika gagal 5 kali berturut-turut, aktifkan cooldown 60 detik
      if (fails >= 5) {
        const lockUntil = Date.now() + 60000;
        try {
          sessionStorage.setItem("auth_register_lockout", String(lockUntil));
        } catch {}
        setLockoutSeconds(60);
        setError("Terlalu banyak percobaan pendaftaran gagal. Silakan tunggu 60 detik.");
      } else if (signUpError.status === 429 || /rate|limit/i.test(signUpError.message)) {
        setError("Batas percobaan pendaftaran tercapai. Silakan coba beberapa saat lagi.");
      } else {
        setError(signUpError.message);
      }
      setLoading(false);
      return;
    }

    // Reset counter gagal pendaftaran
    try {
      sessionStorage.removeItem("auth_register_fails");
      sessionStorage.removeItem("auth_register_lockout");
    } catch {}

    if (data.session) {
      if (data.user) await recordLogin(supabase, data.user.id);
      // Pengguna baru diarahkan ke wizard onboarding
      router.push("/onboarding");
      router.refresh();
    } else {
      setInfo("Pendaftaran berhasil! Silakan cek kotak masuk email Anda untuk konfirmasi akun, lalu login.");
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-400";

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 p-6 [background-image:radial-gradient(circle,#2a2547_1px,transparent_1px)] [background-size:24px_24px]">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl md:p-10 border border-slate-100">
        {/* Backlink ke Landing Page */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-brand-500"
        >
          <i className="bi bi-arrow-left text-sm"></i>
          Kembali ke Beranda
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-white shadow-md shadow-brand-500/20">
            <i className="bi bi-book text-xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold">
              Buat Akun <span className="text-brand-500">belajar.skuy</span>
            </h1>
            <p className="text-xs text-slate-500">Gratis, langsung bisa buat kursus &amp; simulasi.</p>
          </div>
        </div>

        {/* Lockout Banner */}
        {lockoutSeconds > 0 && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 shadow-sm">
            <p className="font-bold flex items-center gap-1.5">
              <span>⏳</span> Pendaftaran Dikunci Sementara
            </p>
            <p className="mt-1">
              Terlalu banyak percobaan. Silakan tunggu{" "}
              <span className="font-mono font-bold text-rose-900">
                {String(Math.floor(lockoutSeconds / 60)).padStart(2, "0")}:
                {String(lockoutSeconds % 60).padStart(2, "0")}
              </span>{" "}
              sebelum mencoba mendaftar kembali.
            </p>
          </div>
        )}

        {!supabaseConfigured && (
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700">
            Supabase belum dikonfigurasi — isi{" "}
            <code className="font-mono">next/.env.local</code> lalu restart dev server.
          </div>
        )}

        {/* Tombol Opsi: Daftar dengan Google (OAuth) */}
        <button
          type="button"
          onClick={signUpWithGoogle}
          disabled={loading || !supabaseConfigured || lockoutSeconds > 0}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 shadow-sm active:scale-95"
        >
          <GoogleIcon />
          Daftar dengan Google
        </button>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          atau daftar manual dengan email
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Username */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Username <span className="text-rose-500">*</span>
            </label>
            <input
              required
              minLength={3}
              maxLength={30}
              disabled={lockoutSeconds > 0}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
              placeholder="belajarskuy_user"
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              3–30 karakter: huruf kecil, angka, garis bawah (_).
            </p>
          </div>

          {/* Nama Lengkap */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Nama Lengkap <span className="text-rose-500">*</span>
            </label>
            <input
              required
              minLength={2}
              maxLength={100}
              disabled={lockoutSeconds > 0}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nama lengkap Anda"
              className={inputCls}
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              disabled={lockoutSeconds > 0}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@contoh.com"
              className={inputCls}
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              disabled={lockoutSeconds > 0}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className={inputCls}
            />

            {/* Live Password Strength Meter */}
            {password && (
              <div className="mt-2 space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Kekuatan Password:</span>
                  <span
                    className={`font-bold ${
                      strength.level === "weak"
                        ? "text-rose-600"
                        : strength.level === "medium"
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {strength.label}
                  </span>
                </div>
                {/* Strength Bar */}
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full ${strength.color} transition-all duration-300 rounded-full`}
                    style={{ width: strength.barWidth }}
                  />
                </div>

                {/* Criteria Checklist */}
                <div className="pt-1 text-[10px] space-y-0.5 text-slate-500">
                  <p className={strength.hasLength ? "text-emerald-600 font-medium" : ""}>
                    {strength.hasLength ? "✓" : "○"} Minimal 8 karakter
                  </p>
                  <p className={strength.hasUpperLower ? "text-emerald-600 font-medium" : ""}>
                    {strength.hasUpperLower ? "✓" : "○"} Campuran huruf besar (A-Z) dan kecil (a-z)
                  </p>
                  <p className={strength.hasNumberOrSymbol ? "text-emerald-600 font-medium" : ""}>
                    {strength.hasNumberOrSymbol ? "✓" : "○"} Mengandung angka (0-9) atau simbol unik
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Konfirmasi Password */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Konfirmasi Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              disabled={lockoutSeconds > 0}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ketik ulang password Anda"
              className={`${inputCls} ${
                passwordsMismatch
                  ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                  : passwordsMatch
                  ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100"
                  : ""
              }`}
            />
            {passwordsMatch && (
              <p className="mt-1 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                ✓ Password cocok
              </p>
            )}
            {passwordsMismatch && (
              <p className="mt-1 text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                ⚠️ Konfirmasi password belum cocok
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
          )}
          {info && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{info}</p>
          )}

          <button
            type="submit"
            disabled={loading || !supabaseConfigured || lockoutSeconds > 0 || passwordsMismatch}
            className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
          >
            {loading
              ? "Mendaftarkan..."
              : lockoutSeconds > 0
              ? `Tunggu (${lockoutSeconds}s)`
              : "Daftar →"}
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
