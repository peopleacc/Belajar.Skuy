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
