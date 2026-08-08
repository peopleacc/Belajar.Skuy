// Helper server-side untuk memanggil backend Express (service/).
// JANGAN dipakai dari client component — EXPRESS_INTERNAL_SECRET tidak boleh bocor ke browser.

import { Agent, setGlobalDispatcher } from "undici";

/**
 * Batas waktu panggilan ke Express. `fetch` bawaan Node memakai undici, yang
 * default-nya MEMUTUS di 5 menit (headersTimeout & bodyTimeout = 300.000ms) —
 * generate kurikulum/konten/penilaian yang lama jadi putus di tengah jalan, dan
 * karena undici melemparnya sebagai "TypeError: fetch failed", blok catch di
 * route menyangkanya service mati ("jalankan npm run dev:api") padahal sebenarnya
 * masih bekerja. Dinaikkan dari 5 menit ke 7 menit (Fitur EE, planning-update-12) —
 * cukup untuk generate yang wajar tanpa membuat user menunggu terlalu lama kalau
 * service-nya memang benar-benar mati.
 *
 * Diterapkan lewat setGlobalDispatcher (bukan opsi per-fetch): batas ini milik
 * dispatcher undici, tidak bisa dilonggarkan lewat AbortSignal — signal hanya
 * bisa MEMPERPENDEK. Sudah diuji: dispatcher dari paket npm ini memang mengubah
 * perilaku `fetch` global bawaan Node.
 */
export const EXPRESS_TIMEOUT_MS = 7 * 60 * 1000;

setGlobalDispatcher(
  new Agent({ headersTimeout: EXPRESS_TIMEOUT_MS, bodyTimeout: EXPRESS_TIMEOUT_MS })
);

/**
 * Bedakan "service benar-benar mati" dari "kelamaan lalu diputus" — dua-duanya
 * sampai ke catch sebagai `TypeError: fetch failed`, tapi saran perbaikannya
 * berlawanan, jadi pesannya tidak boleh disamakan.
 */
export function expressErrorMessage(err: unknown, fallbackHint = "npm run dev:api"): string {
  const code = (err as { cause?: { code?: string } })?.cause?.code ?? "";
  if (code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT") {
    return `Prosesnya melewati batas ${EXPRESS_TIMEOUT_MS / 60000} menit dan dihentikan. Coba lagi dengan materi/topik yang lebih ringkas.`;
  }
  return `API service (Express) tidak berjalan. Jalankan ${fallbackHint}.`;
}

const BASE_URL = process.env.EXPRESS_API_BASE_URL ?? "http://localhost:4000";

// Simulasi presentasi jalan sebagai PROSES Express TERPISAH (lihat
// service/src/simulationIndex.js) — base URL & secret bisa beda, tapi secara
// default memakai secret yang sama (satu Next, cukup satu kredensial untuk
// dipercaya kedua proses). Ganti SIMULATION_INTERNAL_SECRET kalau nanti mau
// mengisolasi kredensial juga.
const SIMULATION_BASE_URL = process.env.SIMULATION_API_BASE_URL ?? "http://localhost:4001";
const SIMULATION_SECRET =
  process.env.SIMULATION_INTERNAL_SECRET ?? process.env.EXPRESS_INTERNAL_SECRET ?? "";

export async function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.EXPRESS_INTERNAL_SECRET ?? "",
      ...init.headers,
    },
    cache: "no-store",
  });
}

/** Varian untuk multipart/form-data (upload PDF) — Content-Type diatur otomatis oleh fetch. */
export async function apiFetchForm(path: string, formData: FormData) {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "x-internal-secret": process.env.EXPRESS_INTERNAL_SECRET ?? "" },
    body: formData,
    cache: "no-store",
  });
}

/** Sama seperti apiFetch, tapi ke proses simulasi (bukan service utama). */
export async function apiFetchSimulation(path: string, init: RequestInit = {}) {
  return fetch(`${SIMULATION_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SIMULATION_SECRET,
      ...init.headers,
    },
    cache: "no-store",
  });
}

/** Sama seperti apiFetchForm, tapi ke proses simulasi (upload audio segmen). */
export async function apiFetchSimulationForm(path: string, formData: FormData) {
  return fetch(`${SIMULATION_BASE_URL}${path}`, {
    method: "POST",
    headers: { "x-internal-secret": SIMULATION_SECRET },
    body: formData,
    cache: "no-store",
  });
}

export type HealthStatus = {
  service: string;
  status: string;
  aiProvider: string;
  redis: { ok: boolean; error?: string };
  supabase: { ok: boolean; error?: string };
  time: string;
};

export async function getHealth(): Promise<HealthStatus | null> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as HealthStatus;
  } catch {
    return null;
  }
}
