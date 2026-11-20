import Link from "next/link";
import {
  sessionKind,
  sessionHref,
  KIND_LABEL,
  KIND_ICON,
  STATUS_BADGE,
  getSessionActionMeta,
  type HistoryRow,
} from "@/lib/simulationHistory";

/**
 * Fitur DE (planning-update-11) — tabel riwayat sesi, dipakai BERSAMA oleh
 * dashboard simulasi dan kedua halaman "sesi baru".
 *
 * Komponen ini murni PENYAJI: dia menerima baris yang SUDAH disaring & diiris,
 * tidak tahu-menahu soal paginasi atau dari mana datanya. Itu yang membuatnya
 * tetap bisa dipakai di server component (tanpa JS ke browser) sekaligus di
 * halaman yang cuma mau 10 baris teratas tanpa paginasi.
 */
export default function SessionHistoryTable({
  rows,
  emptyText = "Belum ada sesi.",
  showType = true,
}: {
  rows: HistoryRow[];
  emptyText?: string;
  /** Halaman khusus-satu-jenis tidak perlu kolom "Tipe" yang isinya seragam. */
  showType?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-sm bg-white p-8 text-center shadow-card">
        <p className="text-sm text-slate-400">{emptyText}</p>
      </div>
    );
  }

  const headers = [
    "Tanggal",
    ...(showType ? ["Tipe"] : []),
    "Skor Akhir",
    "Isi",
    "Penyampaian",
    "Status",
    "",
  ];

  return (
    <div className="rounded-sm bg-white shadow-card overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h, i) => (
              <th
                key={`${h}-${i}`}
                className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ session: s, scores }, i) => {
            const kind = sessionKind(s);
            const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.abandoned;
            const actionMeta = getSessionActionMeta(s, scores);
            const variantCls =
              actionMeta.variant === "amber"
                ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-200"
                : actionMeta.variant === "cyan"
                ? "bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20 border-cyan-200"
                : actionMeta.variant === "subtle"
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
                : "bg-brand-500/10 text-brand-700 hover:bg-brand-500/20 border-brand-200";
            return (
              <tr key={s.id} className={i % 2 === 1 ? "bg-surface-2/60" : undefined}>
                <td className="px-5 py-3 text-xs text-slate-500">
                  {new Date(s.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                </td>
                {showType && (
                  <td className="px-5 py-3 text-sm">
                    <span className="flex items-center gap-1.5">
                      <i className={`bi ${KIND_ICON[kind]} text-brand-500`}></i>
                      {KIND_LABEL[kind]}
                    </span>
                  </td>
                )}
                <td className="px-5 py-3 text-sm font-semibold">{scores?.overall ?? "—"}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{scores?.content ?? "—"}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{scores?.delivery ?? "—"}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={actionMeta.href}
                    title={actionMeta.tooltip}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold shadow-sm transition ${variantCls}`}
                  >
                    <i className={`bi ${actionMeta.icon}`} />
                    <span>{actionMeta.label}</span>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
