"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import BrandLogo from "@/components/BrandLogo";
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

    // Lapisan 1 (Task 5C-RG): Pre-Registration Identity Conflict Check (/api/auth/check)
    try {
      const checkRes = await fetch("/api/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, username: cleanUsername }),
      });

      if (!checkRes.ok) {
        const checkData = await checkRes.json().catch(() => ({}));
        if (checkData.message || checkData.error) {
          setError(checkData.message || checkData.error);
          setLoading(false);
          return;
        }
      }
    } catch (checkErr) {
      console.warn("Pre-registration check fallback guard", checkErr);
    }

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

    // Lapisan 2 (Task 5C-RG): GoTrue Anti-Email Enumeration Guard (Empty Identities)
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError(
        "Email ini sudah terdaftar di sistem kami. Jika sebelumnya Anda mendaftar dengan Google, silakan login menggunakan tombol Google di halaman Login."
      );
      setLoading(false);
      return;
    }

    try {
      sessionStorage.removeItem("auth_register_fails");
      sessionStorage.removeItem("auth_register_lockout");
    } catch {}

    if (data.session) {
      if (data.user) await recordLogin(supabase, data.user.id);
      router.push("/onboarding");
      router.refresh();
    } else {
      setInfo("Pendaftaran berhasil! Silakan periksa kotak masuk email Anda untuk konfirmasi aktivasi akun, lalu masuk.");
      setLoading(false);
    }
  }

  const inputCls =
    "h-12 w-full rounded-2xl border border-border/90 bg-surface-2 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100 disabled:text-slate-400";

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
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border/80 bg-white shadow-2xl transition-colors duration-300 lg:grid-cols-12 min-h-[640px]">
          {/* Kolom Kiri: Visual Story & 3D Illustration */}
          <div className="relative flex flex-col justify-between bg-surface-2 p-8 lg:col-span-5 sm:p-10">
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
                Langkah Awal
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                Mulai dari rasa
                <br />
                ingin tahu.
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs">
                Buat akun gratis. Susun materi kursus pertamamu dan coba latihan simulasi bicara dengan AI.
              </p>
            </div>

            <div className="relative my-8 flex items-center justify-center">
              <Image
                src="/images/study-illustration.webp"
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

          {/* Kolom Kanan: Form Pendaftaran */}
          <div className="flex items-center justify-center p-8 sm:p-12 lg:col-span-7">
            <div className="w-full max-w-md">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  Buat akun baru.
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Gratis, langsung bisa generate kursus &amp; coba simulasi AI.
                </p>
              </div>

              {/* Lockout Banner */}
              {lockoutSeconds > 0 && (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-sm">
                  <p className="flex items-center gap-2 font-bold text-rose-900">
                    <i className="bi bi-hourglass-split text-rose-600"></i>
                    <span>Pendaftaran Dikunci Sementara</span>
                  </p>
                  <p className="mt-1 leading-relaxed">
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
                <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  Supabase belum dikonfigurasi — isi <code className="font-mono">next/.env.local</code> lalu restart dev server.
                </div>
              )}

              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={signUpWithGoogle}
                disabled={loading || !supabaseConfigured || lockoutSeconds > 0}
                className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border/90 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-surface-2 active:scale-[0.99] disabled:opacity-50"
              >
                <GoogleIcon />
                <span>Daftar dengan Google</span>
              </button>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-400">
                <div className="h-px flex-1 bg-border/80" />
                <span>atau daftar manual dengan email</span>
                <div className="h-px flex-1 bg-border/80" />
              </div>

              {/* Registration Form */}
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Username <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      minLength={3}
                      maxLength={30}
                      disabled={lockoutSeconds > 0}
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                      placeholder="user_skuy"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Nama Lengkap <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      disabled={lockoutSeconds > 0}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nama lengkapmu"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Email <span className="text-rose-500">*</span>
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

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Kata Sandi <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      disabled={lockoutSeconds > 0}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      className={inputCls}
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

                  {/* Password Strength Meter */}
                  {password && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Kekuatan Sandi:</span>
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
                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full ${strength.color} transition-all duration-300 rounded-full`}
                          style={{ width: strength.barWidth }}
                        />
                      </div>
                      <div className="pt-1 text-[11px] space-y-0.5 text-slate-500">
                        <p className={strength.hasLength ? "text-emerald-600 font-medium flex items-center gap-1.5" : "flex items-center gap-1.5"}>
                          <i className={`bi ${strength.hasLength ? "bi-check-lg text-emerald-500" : "bi-dash text-slate-400"}`}></i>
                          <span>Minimal 8 karakter</span>
                        </p>
                        <p className={strength.hasUpperLower ? "text-emerald-600 font-medium flex items-center gap-1.5" : "flex items-center gap-1.5"}>
                          <i className={`bi ${strength.hasUpperLower ? "bi-check-lg text-emerald-500" : "bi-dash text-slate-400"}`}></i>
                          <span>Kombinasi huruf besar (A-Z) dan kecil (a-z)</span>
                        </p>
                        <p className={strength.hasNumberOrSymbol ? "text-emerald-600 font-medium flex items-center gap-1.5" : "flex items-center gap-1.5"}>
                          <i className={`bi ${strength.hasNumberOrSymbol ? "bi-check-lg text-emerald-500" : "bi-dash text-slate-400"}`}></i>
                          <span>Mengandung angka (0-9) atau simbol unik</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Konfirmasi Kata Sandi <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={8}
                      disabled={lockoutSeconds > 0}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang kata sandi Anda"
                      className={`${inputCls} ${
                        passwordsMismatch
                          ? "border-rose-400 focus:border-rose-500"
                          : passwordsMatch
                          ? "border-emerald-400 focus:border-emerald-500"
                          : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? "Sembunyikan konfirmasi kata sandi" : "Tampilkan konfirmasi kata sandi"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"
                    >
                      <i className={`bi ${showConfirmPassword ? "bi-eye-slash-fill" : "bi-eye-fill"} text-base`}></i>
                    </button>
                  </div>

                  {passwordsMatch && (
                    <p className="mt-1.5 text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                      <i className="bi bi-check-circle-fill"></i>
                      <span>Kata sandi cocok</span>
                    </p>
                  )}
                  {passwordsMismatch && (
                    <p className="mt-1.5 text-xs font-semibold text-rose-500 flex items-center gap-1.5">
                      <i className="bi bi-exclamation-circle-fill"></i>
                      <span>Konfirmasi kata sandi belum cocok</span>
                    </p>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 flex items-center gap-2">
                    <i className="bi bi-x-circle-fill"></i>
                    <span>{error}</span>
                  </div>
                )}
                {info && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                    <i className="bi bi-check-circle-fill text-emerald-600"></i>
                    <span>{info}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !supabaseConfigured || lockoutSeconds > 0 || passwordsMismatch}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-all duration-200 hover:bg-brand-600 active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? (
                    <span>Mendaftarkan akun...</span>
                  ) : lockoutSeconds > 0 ? (
                    <span>Tunggu ({lockoutSeconds}s)</span>
                  ) : (
                    <>
                      <span>Daftar Akun Baru</span>
                      <i className="bi bi-arrow-right text-xs"></i>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-8 text-center text-xs text-slate-500">
                Sudah punya akun?{" "}
                <Link
                  href="/login"
                  className="font-bold text-brand-500 hover:underline underline-offset-4"
                >
                  Masuk di sini
                </Link>
              </p>
            </div>
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
