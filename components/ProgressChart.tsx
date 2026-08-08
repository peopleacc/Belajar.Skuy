"use client";

import { useState } from "react";

export type ChartPoint = { label: string; value: number };

// Area chart SVG (tanpa library) untuk "Learning Progress". Toggle Month/Week.
function buildPath(points: ChartPoint[], w: number, h: number, pad: number) {
  const n = points.length;
  if (n === 0) return { line: "", area: "" };
  const maxV = 100; // skor 0-100
  const stepX = n > 1 ? (w - pad * 2) / (n - 1) : 0;
  const x = (i: number) => pad + i * stepX;
  const y = (v: number) => h - pad - (Math.max(0, Math.min(maxV, v)) / maxV) * (h - pad * 2);

  const coords = points.map((p, i) => ({ x: x(i), y: y(p.value) }));
  // Kurva halus (Catmull-Rom → Bézier)
  let line = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? 0 : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2 < coords.length ? i + 2 : coords.length - 1];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  const area = `${line} L ${coords[coords.length - 1].x} ${h - pad} L ${coords[0].x} ${h - pad} Z`;
  return { line, area };
}

export default function ProgressChart({
  week,
  month,
}: {
  week: ChartPoint[];
  month: ChartPoint[];
}) {
  const [range, setRange] = useState<"month" | "week">("month");
  const points = range === "month" ? month : week;
  const W = 520;
  const H = 220;
  const pad = 28;
  const { line, area } = buildPath(points, W, H, pad);
  const hasData = points.some((p) => p.value > 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Learning Progress</h2>
          <p className="text-xs text-brand-500">Rata-rata skor kuis dari waktu ke waktu</p>
        </div>
        <div className="flex rounded-full bg-slate-100 p-1 text-xs font-semibold">
          {(["month", "week"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 capitalize transition ${
                range === r ? "bg-brand-500 text-white" : "text-slate-500"
              }`}
            >
              {r === "month" ? "Month" : "Week"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik progres belajar">
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* garis grid horizontal */}
          {[0, 25, 50, 75, 100].map((g) => {
            const yy = H - pad - (g / 100) * (H - pad * 2);
            return <line key={g} x1={pad} y1={yy} x2={W - pad} y2={yy} stroke="var(--border)" strokeWidth={1} />;
          })}
          {hasData && (
            <>
              <path d={area} fill="url(#areaFill)" />
              <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" />
            </>
          )}
          {/* label sumbu X */}
          {points.map((p, i) => {
            const n = points.length;
            const stepX = n > 1 ? (W - pad * 2) / (n - 1) : 0;
            return (
              <text
                key={i}
                x={pad + i * stepX}
                y={H - 8}
                textAnchor="middle"
                className="fill-slate-400"
                fontSize={10}
              >
                {p.label}
              </text>
            );
          })}
        </svg>
        {!hasData && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Belum ada data kuis — kerjakan kuis untuk melihat progresmu.
          </p>
        )}
      </div>
    </div>
  );
}
