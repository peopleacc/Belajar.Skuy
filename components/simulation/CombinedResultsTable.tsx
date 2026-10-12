"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  sessionKind,
  sessionHref,
  KIND_LABEL,
  KIND_ICON,
  STATUS_BADGE,
  type HistoryRow,
  type SessionKind,
} from "@/lib/simulationHistory";
import QuickDetailModal from "@/components/simulation/QuickDetailModal";

const PER_PAGE = 10;

type FilterKind = "all" | SessionKind;

const FILTER_TABS: { value: FilterKind; label: string; icon: string }[] = [
  { value: "all", label: "Semua Sesi", icon: "bi-grid-fill" },
  { value: "presentation", label: "Presentasi", icon: "bi-easel2-fill" },
  { value: "qa", label: "Sesi Tanya Jawab", icon: "bi-question-circle-fill" },
  { value: "interview", label: "Interview", icon: "bi-briefcase-fill" },
  { value: "wawancara", label: "Wawancara", icon: "bi-mic-fill" },
];

export default function CombinedResultsTable({
  initialRows,
}: {
  initialRows: HistoryRow[];
}) {
  const [activeFilter, setActiveFilter] = useState<FilterKind>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<HistoryRow | null>(null);

  // Filter & Search Logic
  const filteredRows = useMemo(() => {
    return initialRows.filter((row) => {
      const kind = sessionKind(row.session);
      if (activeFilter !== "all" && kind !== activeFilter) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const ctx = row.session.context as { title?: string; role?: string; prompt?: string } | null;
        const title = (ctx?.title || ctx?.role || "").toLowerCase();
        const prompt = (ctx?.prompt || "").toLowerCase();
        const id = row.session.id.toLowerCase();
        return title.includes(q) || prompt.includes(q) || id.includes(q);
      }
      return true;
    });
  }, [initialRows, activeFilter, searchQuery]);

  // Paginasi
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PER_PAGE));
  const validPage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginatedRows = useMemo(() => {
    const start = (validPage - 1) * PER_PAGE;
    return filteredRows.slice(start, start + PER_PAGE);
  }, [filteredRows, validPage]);

  function handleFilterChange(kind: FilterKind) {
    setActiveFilter(kind);
    setCurrentPage(1);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  }

  return (
    <div className="space-y-6">
      {/* ── Filter Bar & Search Box ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search Box */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <i className="bi bi-search" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Cari berdasarkan judul, topik, atau ID sesi..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none shadow-sm transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills / Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleFilterChange(tab.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <i className={`bi ${tab.icon}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tabel Gabungan Hasil ── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Tanggal &amp; Waktu</th>
                <th className="px-5 py-3.5">Jenis Simulasi</th>
                <th className="px-5 py-3.5">Judul / Topik Sesi</th>
                <th className="px-5 py-3.5 text-center">Skor Total</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((row) => {
                  const { session, scores } = row;
                  const kind = sessionKind(session);
                  const statusInfo = STATUS_BADGE[session.status] ?? STATUS_BADGE.done;
                  const href = sessionHref(session);

                  const title =
                    (session.context as { title?: string; role?: string } | null)?.title ||
                    (session.context as { title?: string; role?: string } | null)?.role ||
                    KIND_LABEL[kind];

                  const overall = scores?.overall;
                  const dateStr = new Date(session.created_at).toLocaleString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={session.id} className="transition hover:bg-slate-50/80">
                      {/* Tanggal */}
                      <td className="whitespace-nowrap px-5 py-4 text-xs font-medium text-slate-500">
                        {dateStr}
                      </td>

                      {/* Jenis Simulasi */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-100">
                          <i className={`bi ${KIND_ICON[kind]}`} />
                          {KIND_LABEL[kind]}
                        </span>
                      </td>

                      {/* Judul / Topik */}
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        <span className="line-clamp-1">{title}</span>
                      </td>

                      {/* Skor Total */}
                      <td className="whitespace-nowrap px-5 py-4 text-center">
                        {overall != null ? (
                          <span
                            className={`inline-block rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                              overall >= 80
                                ? "bg-emerald-500/10 text-emerald-600"
                                : overall >= 60
                                ? "bg-brand-500/10 text-brand-600"
                                : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {overall}/100
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-5 py-4 text-center">
                        <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRow(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 shadow-sm"
                          >
                            🔍 Detail
                          </button>
                          <Link
                            href={href}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-500/20"
                          >
                            Laporan ➔
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <p className="text-base font-semibold text-slate-600">Tidak ada sesi yang ditemukan</p>
                    <p className="mt-1 text-xs">
                      Coba ubah kata kunci pencarian atau ganti filter kategori simulasi.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer Paginasi ── */}
        {filteredRows.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5 sm:flex-row">
            <p className="text-xs text-slate-500">
              Menampilkan <span className="font-semibold text-slate-800">{(validPage - 1) * PER_PAGE + 1}</span> -{" "}
              <span className="font-semibold text-slate-800">
                {Math.min(validPage * PER_PAGE, filteredRows.length)}
              </span>{" "}
              dari <span className="font-semibold text-slate-800">{filteredRows.length}</span> sesi
            </p>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={validPage === 1}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                ◀ Sebelumnya
              </button>

              <span className="px-2 text-xs font-semibold text-slate-600">
                {validPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={validPage === totalPages}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                Selanjutnya ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Detail Modal Popup ── */}
      <QuickDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />
    </div>
  );
}
