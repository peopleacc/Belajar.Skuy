"use client";

import { useState } from "react";
import Link from "next/link";
import ActiveSessionModal, { type ActiveSessionData } from "./ActiveSessionModal";

export default function ActiveSessionBanner({
  session,
}: {
  session: ActiveSessionData;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="mb-8 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <i className="bi bi-play-circle-fill text-lg animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                  SESI AKTIF BERJALAN
                </span>
                <span className="text-xs text-slate-500">
                  Dimulai {new Date(session.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                </span>
              </div>
              <h3 className="mt-1 text-sm font-bold text-slate-800 sm:text-base">
                {session.title || "Sesi Simulasi Belum Selesai"}
              </h3>
              <p className="text-xs text-slate-600">
                Tersimpan {session.answeredCount} dari {session.totalItems} bagian. Lanjutkan untuk menyelesaikan latihan tanpa membakar kuota lagi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Kelola Sesi
            </button>
            <Link
              href={`/simulation/run/${session.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600"
            >
              <i className="bi bi-play-fill text-base" />
              <span>Lanjutkan</span>
            </Link>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ActiveSessionModal
          session={session}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

