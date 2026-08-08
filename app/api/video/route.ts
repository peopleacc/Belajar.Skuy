import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

// Proxy ke Express /api/video (scraping YouTube). Cukup butuh sesi login; hasilnya
// hanya metadata video publik, jadi tidak sensitif. Fallback aman ke { video: null }.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return NextResponse.json({ video: null });
  }
  try {
    const res = await apiFetch(`/api/video?q=${encodeURIComponent(q)}`, { method: "GET" });
    const data = await res.json().catch(() => ({ video: null }));
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ video: null });
  }
}
