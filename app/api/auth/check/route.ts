import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Regex validasi format email RFC 5322 dasar
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

// Task 15A-AS: In-memory sliding window rate limiter per client IP
// Membatasi maksimal 20 pengecekan per menit per IP untuk mencegah enumerasi massal (F01).
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = ipRateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    // Bersihkan entri kedaluwarsa secara berkala
    if (ipRateLimitMap.size > 500) {
      for (const [key, val] of ipRateLimitMap.entries()) {
        if (now > val.resetAt) ipRateLimitMap.delete(key);
      }
    }
    return false;
  }

  if (record.count >= 20) {
    return true;
  }

  record.count++;
  return false;
}

/**
 * Endpoint Pre-Registration Identity Conflict Check (Task 5B-DC & Hardened in Task 15A-AS)
 *
 * Memeriksa apakah email atau username sudah terdaftar sebelum proses pendaftaran Supabase Auth.
 * Remediasi F01:
 * 1. Mencegah enumerasi akun dengan memberikan respons generik (tanpa membocorkan provider OAuth).
 * 2. Menerapkan rate limit server-side 20 req/menit per client IP.
 */
export async function POST(request: NextRequest) {
  try {
    // 0. Ekstraksi client IP & pemeriksaan rate limit
    const forwardedFor = request.headers.get("x-forwarded-for");
    const clientIp = (forwardedFor ? forwardedFor.split(",")[0].trim() : null) ||
      request.headers.get("x-real-ip") ||
      "unknown-ip";

    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan pemeriksaan. Silakan coba lagi beberapa saat lagi." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";

    // 1. Validasi minimal input
    if (!email && !username) {
      return NextResponse.json(
        { error: "Parameter email atau username harus diisi." },
        { status: 400 }
      );
    }

    // 2. Pemeriksaan Email (Anti-Enumeration)
    if (email) {
      if (email.length > 150 || !EMAIL_REGEX.test(email)) {
        return NextResponse.json(
          { error: "Format email tidak valid (contoh: nama@domain.com)." },
          { status: 400 }
        );
      }

      try {
        const admin = getSupabaseAdmin();
        const { data: usersData, error: listError } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        if (!listError && usersData?.users) {
          const existingUser = usersData.users.find(
            (u) => u.email?.toLowerCase() === email
          );

          if (existingUser) {
            // Task 15A-AS (F01 Remediation):
            // Hentikan pengungkapan provider OAuth (Google vs Email).
            // Kembalikan respons generik seragam untuk melindungi privasi akun pengguna.
            return NextResponse.json(
              {
                exists: true,
                field: "email",
                message:
                  "Email ini sudah terdaftar. Silakan login langsung menggunakan akun Anda.",
              },
              { status: 409 }
            );
          }
        }
      } catch (authErr) {
        console.warn("[AuthCheck] Gagal query auth.admin.listUsers:", authErr);
      }
    }

    // 3. Pemeriksaan Username di tabel profiles
    if (username) {
      if (!USERNAME_REGEX.test(username)) {
        return NextResponse.json(
          { error: "Username harus 3-30 karakter alfanumerik atau underscore (_)." },
          { status: 400 }
        );
      }

      try {
        const admin = getSupabaseAdmin();
        const { data: profile } = await admin
          .from("profiles")
          .select("id")
          .eq("username", username)
          .maybeSingle();

        if (profile) {
          return NextResponse.json(
            {
              exists: true,
              field: "username",
              message: "Username ini sudah digunakan. Silakan pilih username lain.",
            },
            { status: 409 }
          );
        }
      } catch (profileErr) {
        console.warn("[AuthCheck] Gagal query tabel profiles:", profileErr);
      }
    }

    // 4. Bersih / Tersedia
    return NextResponse.json({ available: true }, { status: 200 });
  } catch (err: any) {
    console.error("[AuthCheck] Internal Error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat memeriksa data akun." },
      { status: 500 }
    );
  }
}
