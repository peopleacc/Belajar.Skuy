/**
 * Helper penentu Base URL aplikasi yang fleksibel & aman untuk lingkungan:
 * - Localhost (Development)
 * - Vercel Preview Deployments
 * - Vercel Production Custom Domain
 */
export function getAppUrl(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";

  const url =
    envUrl.startsWith("http://") || envUrl.startsWith("https://")
      ? envUrl
      : `https://${envUrl}`;

  return url.replace(/\/+$/, "");
}

/**
 * Task 15A-AS: Sanitasi parameter redirect 'next' (Anti-Open-Redirect & Anti-XSS)
 *
 * Mencegah serangan Open Redirect, protocol-relative URL bypass (//evil.com),
 * backslash bypass (/\evil.com, \evil.com), dan XSS skema berbahaya (javascript:, data:).
 * Hanya mengizinkan path relatif internal yang valid diawali dengan satu karakter '/'.
 */
export function sanitizeInternalUrl(target?: string | null, fallback = "/portal"): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();

  // Tolak string kosong atau yang memuat control characters/whitespace tersembunyi
  if (!trimmed || /[\x00-\x1F\x7F\s]/.test(trimmed)) {
    return fallback;
  }

  // Wajib diawali '/' dan TIDAK boleh diawali '//', '/\', atau '\'
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) {
    return fallback;
  }

  // Tolak skema URI berbahaya di mana pun dalam string (mis. javascript:, data:, vbscript:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || /javascript:/i.test(trimmed) || /data:/i.test(trimmed) || /vbscript:/i.test(trimmed)) {
    return fallback;
  }

  // Tolak backslash di mana pun dalam path (Windows/browser path normalization bypass)
  if (trimmed.includes("\\")) {
    return fallback;
  }

  try {
    // Validasi bahwa saat digabungkan dengan origin dummy, pathname dan search tetap internal
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

