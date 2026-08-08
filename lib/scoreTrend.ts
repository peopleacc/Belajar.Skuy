import type { ChartPoint } from "@/components/ProgressChart";

// Fitur CF (planning-update-9) — bangun titik grafik "rata-rata kumulatif dari
// waktu ke waktu" dari daftar {waktu, skor}. Pola perhitungannya SAMA PERSIS
// dengan yang sudah dipakai `dashboard/page.tsx` untuk skor kuis — diekstrak ke
// sini supaya dashboard simulasi tidak menyalin ulang logika `cumAvg`/`ymd`.
//
// `dashboard/page.tsx` sendiri SENGAJA belum dialihkan ke fungsi ini (halaman
// itu sudah jalan & terverifikasi; menyentuhnya cuma demi konsolidasi kode
// berisiko regresi untuk manfaat kecil). Catatan ini supaya suatu saat kalau ada
// perubahan pada rumus tren, keduanya diingat untuk disinkronkan.

const DAY_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function endOfDay(d: Date) {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e.getTime();
}

/** @param points {t: epoch ms, s: skor} — TIDAK perlu terurut, diurutkan di dalam. */
export function buildTrendPoints(
  points: { t: number; s: number }[]
): { week: ChartPoint[]; month: ChartPoint[] } {
  const sorted = [...points].sort((a, b) => a.t - b.t);

  function cumAvg(tEnd: number) {
    let sum = 0;
    let c = 0;
    for (const p of sorted) {
      if (p.t <= tEnd) {
        sum += p.s;
        c++;
      } else break;
    }
    return c ? Math.round(sum / c) : 0;
  }

  const week: ChartPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    week.push({ label: DAY_ID[d.getDay()], value: cumAvg(endOfDay(d)) });
  }

  const month: ChartPoint[] = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    month.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, value: cumAvg(endOfDay(d)) });
  }

  return { week, month };
}

/** Hitung sesi per hari, N hari terakhir — dipakai heatmap frekuensi latihan. */
export function buildDailyCounts(
  dates: string[],
  days: number
): { key: string; count: number }[] {
  const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const countByDay = new Map<string, number>();
  for (const iso of dates) {
    const k = ymd(new Date(iso));
    countByDay.set(k, (countByDay.get(k) ?? 0) + 1);
  }
  const out: { key: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = ymd(d);
    out.push({ key: k, count: countByDay.get(k) ?? 0 });
  }
  return out;
}
