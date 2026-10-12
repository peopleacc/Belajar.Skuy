import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LANG_COOKIE, getDict, normalizeLang } from "@/lib/i18n";
import { getSessionUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import ProgressChart from "@/components/ProgressChart";
import SessionHistoryTable from "@/components/simulation/SessionHistoryTable";
import { buildTrendPoints, buildDailyCounts } from "@/lib/scoreTrend";
import {
  fetchSimulationHistory,
  sessionKind,
  KIND_LABEL,
  KIND_ICON,
  type SessionKind,
} from "@/lib/simulationHistory";

export const metadata: Metadata = {
  title: "Simulasi — belajar.skuy",
};

const CARD = "rounded-sm bg-white shadow-card";
const PER_PAGE = 10; // Fitur DG — baris riwayat per halaman

export default async function SimulationHome({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const store = await cookies();
  const lang = normalizeLang(store.get(LANG_COOKIE)?.value);
  const t = getDict(lang);
  const td = t.simulationDash; // Fitur DK

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const history = await fetchSimulationHistory(supabase);

  // Sesi yang punya laporan DENGAN skor — ini yang dipakai chart (DoD: sesi
  // belum dinilai jangan menarik rata-rata secara menyesatkan, tapi tetap
  // muncul di tabel).
  const scored = history.filter((r) => r.scores?.overall != null);

  // ── Widget 1: skor dari waktu ke waktu (ProgressChart dipakai ULANG apa adanya) ──
  const { week, month } = buildTrendPoints(
    scored.map((r) => ({ t: new Date(r.session.created_at).getTime(), s: r.scores!.overall! }))
  );

  // ── Widget 2: isi vs penyampaian (rata-rata) ──
  const contentVals = scored.map((r) => r.scores!.content).filter((v): v is number => v != null);
  const deliveryVals = scored.map((r) => r.scores!.delivery).filter((v): v is number => v != null);
  const avg = (vals: number[]) =>
    vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  const avgContent = avg(contentVals);
  const avgDelivery = avg(deliveryVals);

  // ── Widget 3: distribusi jenis sesi ──
  const kindCounts: Record<SessionKind, number> = { presentation: 0, interview: 0, qa: 0, wawancara: 0 };
  for (const r of history) kindCounts[sessionKind(r.session)]++;
  const totalKind = history.length;

  // ── Widget 4: frekuensi latihan (35 hari terakhir) ──
  const heat = buildDailyCounts(history.map((r) => r.session.created_at), 35);

  const hasAnySession = history.length > 0;
  const hasScored = scored.length > 0;

  // ── Fitur DG: paginasi tabel riwayat ──
  // Chart di atas SENGAJA tetap memakai `history` penuh — yang dipaginasi cuma
  // tabelnya. Datanya diiris di memori dari 200 sesi yang memang sudah diambil
  // untuk kebutuhan chart, jadi tidak ada query tambahan ke Supabase.
  const totalPages = Math.max(1, Math.ceil(history.length / PER_PAGE));
  const rawPage = Number.parseInt((await searchParams)?.page ?? "1", 10);
  // `?page` sembarangan (0, negatif, huruf, melebihi jumlah halaman) dijepit ke
  // halaman valid terdekat — bukan dibiarkan error.
  const page = Number.isFinite(rawPage) ? Math.min(Math.max(rawPage, 1), totalPages) : 1;
  const pageRows = history.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t.portal.modes.simulation.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {td.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/simulation/new"
            className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
          >
            {td.newPresentation}
          </Link>
          <Link
            href="/simulation/interview"
            className="rounded-xl border border-brand-500 px-5 py-3 text-sm font-semibold text-brand-500 transition hover:bg-brand-500 hover:text-white"
          >
            {td.newInterview}
          </Link>
        </div>
      </div>

      {!hasAnySession ? (
        <div className={`${CARD} p-10 text-center`}>
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-2xl text-brand-500">
            <i className="bi bi-camera-video-fill"></i>
          </span>
          <p className="font-semibold">{td.emptyTitle}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{td.emptyBody}</p>
        </div>
      ) : (
        <>
          {/* ── Skor dari waktu ke waktu + Isi vs Penyampaian ─────────── */}
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <section className={`${CARD} p-6`}>
              <ProgressChart week={week} month={month} />
            </section>

            <section className={`${CARD} p-6`}>
              <h2 className="text-lg font-bold">{td.contentVsDelivery}</h2>
              <p className="text-xs text-slate-400">{td.contentVsDeliverySub}</p>
              {!hasScored ? (
                <p className="mt-6 text-sm text-slate-400">{td.notScoredYet}</p>
              ) : (
                <div className="mt-5 space-y-4">
                  {[
                    { label: td.content, value: avgContent, cls: "bg-brand-500" },
                    { label: td.delivery, value: avgDelivery, cls: "bg-accent" },
                  ].map((g) => (
                    <div key={g.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">{g.label}</span>
                        <span className="font-bold text-slate-800">{g.value ?? "—"}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100">
                        <div
                          className={`h-1.5 rounded-full ${g.cls}`}
                          style={{ width: `${g.value ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Distribusi Jenis Sesi + Frekuensi Latihan ─────────────── */}
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
            <section className={`${CARD} p-6`}>
              <h2 className="text-lg font-bold">{td.distribution}</h2>
              <p className="text-xs text-slate-400">
                {td.distributionSub.replace("{n}", String(totalKind))}
              </p>
              <div className="mt-5 space-y-4">
                {(["presentation", "interview", "qa"] as const).map((k) => {
                  const count = kindCounts[k];
                  const pct = totalKind ? Math.round((count / totalKind) * 100) : 0;
                  return (
                    <div key={k}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium text-slate-600">
                          <i className={`bi ${KIND_ICON[k]} text-brand-500`}></i>
                          {KIND_LABEL[k]}
                        </span>
                        <span className="font-bold text-slate-800">{count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={`${CARD} p-6`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{td.practiceFrequency}</h2>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  {td.few}
                  {["bg-brand-100", "bg-brand-300", "bg-brand-500", "bg-brand-700"].map((c) => (
                    <span key={c} className={`h-2.5 w-2.5 rounded-sm ${c}`} />
                  ))}
                  {td.many}
                </div>
              </div>
              <p className="text-xs text-slate-400">{td.practiceFrequencySub}</p>
              <div className="mt-5 grid grid-flow-col grid-rows-7 gap-1.5">
                {heat.map((d) => {
                  const c =
                    d.count === 0
                      ? "bg-slate-100"
                      : d.count === 1
                        ? "bg-brand-200"
                        : d.count === 2
                          ? "bg-brand-400"
                          : "bg-brand-600";
                  return (
                    <span
                      key={d.key}
                      title={`${d.key}: ${d.count} ${td.unit}`}
                      className={`h-4 w-4 rounded-sm ${c}`}
                    />
                  );
                })}
              </div>
            </section>
          </div>

          {/* ── Riwayat Sesi (Fitur DE: komponen bersama, DG: paginasi) ── */}
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{td.historyTitle}</h2>
              <p className="text-xs text-slate-400">
                {history.length} {td.unit} ·{" "}
                {td.pageOf.replace("{page}", String(page)).replace("{total}", String(totalPages))}
              </p>
            </div>

            <SessionHistoryTable rows={pageRows} />

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                {page > 1 ? (
                  <Link
                    href={`/simulation?page=${page - 1}`}
                    className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-surface-2"
                  >
                    {td.prev}
                  </Link>
                ) : (
                  <span />
                )}
                {page < totalPages ? (
                  <Link
                    href={`/simulation?page=${page + 1}`}
                    className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-surface-2"
                  >
                    {td.next}
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
