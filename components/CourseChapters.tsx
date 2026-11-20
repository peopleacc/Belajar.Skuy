"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GenerateSettingsModal,
  DEFAULT_OPTIONS,
  loadSavedOptions,
  saveOptions,
  type GenerateOptions,
} from "@/components/GenerateSettings";
import QuotaExceededModal, {
  type QuotaModalState,
  isQuotaError,
} from "@/components/QuotaExceededModal";

export type ChapterNode = {
  id: string;
  chapter_number: number;
  title: string;
  state: "locked" | "generate" | "available" | "completed";
  percent: number; // progres dalam bab (untuk bar "sedang dipelajari")
  avgScore: number | null; // rata-rata skor bab
  imageUrl?: string | null; // Fitur I — gambar bab (kalau sudah digenerate)
  source_pages?: number[] | null;
};

const HEADER_GRADIENTS = [
  "from-brand-400 to-brand-700",
  "from-brand-500 to-secondary",
  "from-brand-600 to-brand-900",
  "from-accent to-brand-800",
];

function ChapterCard({
  n,
  i,
  onSettings,
}: {
  n: ChapterNode;
  i: number;
  onSettings?: (n: ChapterNode) => void;
}) {
  const inProgress = n.state === "available" && n.percent > 0;
  const isNew = n.state === "available" && n.percent === 0;
  const clickable = n.state !== "locked";

  const badge =
    n.state === "completed" ? (
      <span className="flex items-center gap-1 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-bold text-white">
        <i className="bi bi-check-lg"></i>
        <span>Selesai</span>
      </span>
    ) : n.state === "locked" ? (
      <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
        <i className="bi bi-lock-fill"></i>
        <span>Terkunci</span>
      </span>
    ) : n.state === "generate" ? (
      <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-bold text-ink-900">
        Perlu Generate
      </span>
    ) : isNew ? (
      <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold text-ink-900">NEW</span>
    ) : null;

  const cta =
    n.state === "completed"
      ? "Tinjau Ulang"
      : n.state === "generate"
        ? "Generate & Mulai"
        : inProgress
          ? "Lanjutkan"
          : "Mulai Belajar";

  const inner = (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-sm bg-white shadow-card transition ${clickable ? "hover:-translate-y-0.5 hover:shadow-lg" : "opacity-70"
        }`}
    >
      <div
        className={`relative flex h-20 items-start justify-between overflow-hidden p-3 ${n.imageUrl && n.state !== "locked"
          ? ""
          : `bg-gradient-to-br ${n.state === "locked" ? "from-slate-400 to-slate-500" : HEADER_GRADIENTS[i % HEADER_GRADIENTS.length]}`
          }`}
      >
        {n.imageUrl && n.state !== "locked" && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={n.imageUrl}
              alt={n.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <span className="absolute inset-0 bg-ink-900/25" />
          </>
        )}
        <span className="relative rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
          Bab {n.chapter_number}
        </span>
        <div className="relative flex items-center gap-1.5">
          {n.state === "generate" && onSettings && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSettings(n);
              }}
              title="Pengaturan generate bab"
              aria-label="Pengaturan generate bab"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur transition hover:bg-white/40"
            >
              <i className="bi bi-gear-fill text-[11px]"></i>
            </button>
          )}
          {badge}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 font-bold leading-snug">{n.title}</h3>

        {n.source_pages && n.source_pages.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 border border-sky-100 mt-1.5 self-start">
            <i className="bi bi-file-earmark-pdf-fill text-[9px] text-sky-500"></i>
            <span>Dokumen Hlm. {n.source_pages[0]}{n.source_pages.length > 1 ? `-${n.source_pages[n.source_pages.length - 1]}` : ""}</span>
          </span>
        )}

        {inProgress ? (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-400">
              <span>Sedang dipelajari</span>
              <span>{n.percent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${n.percent}%` }} />
            </div>
          </div>
        ) : (
          <p className="mt-1.5 flex-1 text-xs text-slate-400">
            {n.state === "completed"
              ? "Bab tuntas — bisa ditinjau ulang."
              : n.state === "locked"
                ? "Selesaikan bab sebelumnya dulu untuk membukanya."
                : n.state === "generate"
                  ? "Isi materi siap digenerate instan."
                  : "Materi siap dipelajari."}
          </p>
        )}

        {n.avgScore !== null && (
          <p className="mt-2 text-[11px] font-semibold text-slate-500">
            Rata-rata nilai: <span className="text-brand-600">{n.avgScore}</span>/100
          </p>
        )}

        <span
          className={`mt-4 inline-block rounded-xl px-4 py-2 text-center text-xs font-semibold transition ${n.state === "locked"
            ? "bg-slate-100 text-slate-400"
            : n.state === "completed"
              ? "bg-slate-100 text-slate-600"
              : "bg-brand-500 text-white shadow-lg shadow-brand-500/25"
            }`}
        >
          {n.state === "locked" ? <><i className="bi bi-lock mr-1"></i>Terkunci</> : cta}
        </span>
      </div>
    </div>
  );

  if (!clickable) return <div title="Selesaikan bab sebelumnya dulu">{inner}</div>;
  return (
    <Link href={`/dashboard/learn/${n.id}`} className="group block h-full">
      {inner}
    </Link>
  );
}

function PathView({ nodes }: { nodes: ChapterNode[] }) {
  return (
    <ol className="relative space-y-4 pl-8">
      <span className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-200" aria-hidden />
      {nodes.map((n) => {
        const label =
          n.state === "completed"
            ? "Selesai"
            : n.state === "available"
              ? n.percent > 0
                ? `Sedang dipelajari (${n.percent}%)`
                : "Siap dipelajari"
              : n.state === "generate"
                ? "Belum digenerate — klik untuk generate"
                : "Terkunci — selesaikan bab sebelumnya dulu";
        const dot =
          n.state === "completed" ? (
            <i className="bi bi-check-lg"></i>
          ) : n.state === "locked" ? (
            <i className="bi bi-lock-fill"></i>
          ) : (
            String(n.chapter_number)
          );
        const dotClass =
          n.state === "completed"
            ? "bg-emerald-500 text-white"
            : n.state === "available"
              ? "bg-brand-500 text-white"
              : n.state === "generate"
                ? "bg-amber-400 text-white"
                : "bg-slate-200 text-slate-400";
        const inner = (
          <div
            className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition ${n.state === "locked"
              ? "border-slate-100 bg-slate-50"
              : "border-slate-200 bg-white shadow-card hover:-translate-y-0.5 hover:shadow-lg"
              }`}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Bab {n.chapter_number}
              </p>
              <h3 className={`truncate font-bold ${n.state === "locked" ? "text-slate-400" : "text-slate-800"}`}>
                {n.title}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">{label}</p>
            </div>
            {n.avgScore !== null && (
              <span className="ml-3 shrink-0 text-xs font-semibold text-brand-600">{n.avgScore}/100</span>
            )}
          </div>
        );
        return (
          <li key={n.id} className="relative">
            <span
              className={`absolute -left-8 top-4 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${dotClass}`}
            >
              {dot}
            </span>
            {n.state === "locked" ? <div>{inner}</div> : <Link href={`/dashboard/learn/${n.id}`}>{inner}</Link>}
          </li>
        );
      })}
    </ol>
  );
}

export default function CourseChapters({
  nodes,
  completedCount,
  total,
  nextHref,
  reviewHref,
  voiceLocked = false,
  highLevelLocked = false,
}: {
  nodes: ChapterNode[];
  completedCount: number;
  total: number;
  nextHref: string | null;
  reviewHref: string | null;
  voiceLocked?: boolean; // Fitur CD — paket belum mencakup soal jawab-suara
  highLevelLocked?: boolean; // Fitur 7J-GS — level High terkunci untuk non-premium
}) {
  const router = useRouter();
  const [view, setView] = useState<"kartu" | "path">("kartu");
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // Fitur L/M — modal pengaturan generate bab (opsi diingat lewat localStorage)
  const [settingFor, setSettingFor] = useState<ChapterNode | null>(null);
  const [options, setOptions] = useState<GenerateOptions>(DEFAULT_OPTIONS);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [quotaModal, setQuotaModal] = useState<QuotaModalState>({ isOpen: false });

  function openSettings(n: ChapterNode) {
    setOptions(loadSavedOptions());
    setSettingFor(n);
    setGenError(null);
  }

  async function runGenerate() {
    if (!settingFor) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/chapters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: settingFor.id, options }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (isQuotaError(res.status, data)) {
          setQuotaModal({
            isOpen: true,
            title: "Tingkatkan Paket Anda",
            message: data.error ?? "Fitur ini membutuhkan upgrade paket Premium atau kuota aktif.",
            featureName: data.featureName ?? "Materi Bab High Level",
            targetPlan: data.targetPlan ?? "premium",
          });
          setGenerating(false);
          return;
        }
        setGenError(data.error ?? "Gagal generate materi. Coba lagi ya.");
        setGenerating(false);
        return;
      }
      saveOptions(options);
      router.push(`/dashboard/learn/${settingFor.id}`);
    } catch {
      setGenError("Tidak bisa terhubung ke server. Coba lagi ya.");
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Silakan pilih bab yang ingin kamu pelajari atau kembangkan lebih lanjut.
        </p>
        <div className="flex rounded-full bg-slate-100 p-1 text-xs font-semibold">
          {(["kartu", "path"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 capitalize transition ${view === v ? "bg-brand-500 text-white" : "text-slate-500"
                }`}
            >
              {v === "kartu" ? "Kartu" : "Learning Path"}
            </button>
          ))}
        </div>
      </div>

      {view === "kartu" ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((n, i) => (
            <ChapterCard key={n.id} n={n} i={i} onSettings={openSettings} />
          ))}
          <Link
            href="/dashboard/generate"
            className="group flex flex-col justify-between rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-white via-white to-indigo-50/40 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#283157]/30 hover:shadow-md"
          >
            <div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#283157]/5 border border-[#283157]/10 text-lg text-[#283157] transition-transform duration-300 group-hover:scale-105">
                <i className="bi bi-stars"></i>
              </span>
              <h3 className="mt-3.5 text-sm font-extrabold text-[#283157] leading-snug">
                Ingin Menambah Materi Baru?
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Berikan topik ke AI untuk menyusun course baru sesuai kebutuhanmu.
              </p>
            </div>
            <span className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#283157] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition duration-200 group-hover:bg-[#1f2644] active:scale-95">
              <i className="bi bi-plus-lg text-xs"></i>
              <span>Tambah dengan AI</span>
            </span>
          </Link>
        </div>
      ) : (
        <PathView nodes={nodes} />
      )}

      {/* Bottom bar: progress + aksi */}
      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="min-w-[140px] flex-1">
          <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
            <span>
              {completedCount}/{total} Bab
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        {reviewHref && (
          <Link
            href={reviewHref}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <span className="inline-flex items-center gap-1.5">
              <i className="bi bi-arrow-clockwise"></i>
              <span>Review Ulang</span>
            </span>
          </Link>
        )}
        {nextHref ? (
          <Link
            href={nextHref}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
          >
            <span className="flex items-center gap-1.5">
              <span>Lanjutkan ke Bab</span>
              <i className="bi bi-arrow-right"></i>
            </span>
          </Link>
        ) : (
          <span className="rounded-xl bg-emerald-50 px-5 py-2.5 text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
            <i className="bi bi-check-circle-fill"></i>
            <span>Semua bab selesai</span>
          </span>
        )}
      </div>

      {/* Fitur L/M — modal pengaturan generate bab */}
      {settingFor && (
        <GenerateSettingsModal
          subtitle={`Bab ${settingFor.chapter_number}: ${settingFor.title}`}
          voiceLocked={voiceLocked}
          highLevelLocked={highLevelLocked}
          onHighLevelLockedClick={() => {
            setQuotaModal({
              isOpen: true,
              title: "Level High Membutuhkan Akun Premium",
              message:
                "Level High (8-12 subbab) menyajikan materi pembelajaran yang jauh lebih komprehensif, terperinci, dan berbobot. Upgrade akun Anda ke Premium untuk mengaksesnya.",
              featureName: "Materi Bab High Level (8-12 Subbab)",
              targetPlan: "premium",
            });
          }}
          value={options}
          onChange={setOptions}
          busy={generating}
          error={genError}
          onCancel={() => setSettingFor(null)}
          onSubmit={runGenerate}
        />
      )}

      <QuotaExceededModal
        state={quotaModal}
        onClose={() => setQuotaModal({ isOpen: false })}
      />
    </div>
  );
}
