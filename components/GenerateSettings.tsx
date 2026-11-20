"use client";

import Link from "next/link";

// Fitur L/M — pengaturan generate bab (jumlah soal, level, jumlah subbab), dipakai bersama di
// 3 pintu: modal kartu bab (CourseChapters), panel inline di halaman learn (LearnRoom), dan nanti
// Kuis Kustom (Fitur N/S). Pilihan terakhir diingat di localStorage (BUKAN disimpan ke DB — per
// generation saja, keputusan Fitur L dipertahankan).

// Fitur S — komposisi tipe soal. Total (mcq+essay+voice) SELALU sama dengan jumlah soal
// (quizCount di GenerateOptions, atau questionCount di Kuis Kustom).
export type QuizTypeCounts = { mcq: number; essay: number; voice: number };

/** Fitur T — tipe mana yang AKTIF, eksplisit & terpisah dari angkanya. */
export type QuizTypeEnabled = { mcq: boolean; essay: boolean; voice: boolean };

export type CourseLevel = "High" | "Low";

export type GenerateOptions = {
  quizCount: number;
  level: CourseLevel;
  sectionCount?: number;
  quizTypes: QuizTypeCounts;
};

const MAX_SPECIAL = 5; // esai & esai-suara dibatasi HANYA di mode campuran (lihat rebalance)

function clamp(n: number, min: number, max: number) {
  const v = Number.isFinite(n) ? Math.round(n) : min;
  return Math.max(min, Math.min(max, v));
}

/** Tipe dianggap aktif kalau jumlahnya > 0 — invariant ini DIJAGA oleh rebalanceQuizTypes:
 *  tipe aktif selalu dapat minimal 1, tipe nonaktif selalu 0. */
export function enabledFromCounts(types: Partial<QuizTypeCounts>): QuizTypeEnabled {
  return {
    mcq: Number(types.mcq) > 0,
    essay: Number(types.essay) > 0,
    voice: Number(types.voice) > 0,
  };
}

/**
 * Fitur T — hitung komposisi akhir dari niat user. Total hasil SELALU = `total`.
 *
 * Bug lama (Fitur S): `mcq` selalu dihitung sebagai SISA (`total - essay - voice`) sambil
 * mengabaikan `mcq` yang dikirim pemanggil — akibatnya "matikan Pilihan Ganda" tidak pernah
 * tersimpan, dan karena esai/suara di-cap 5, untuk total > 10 PG mustahil jadi 0.
 * Sekarang tipe aktif diberikan EKSPLISIT lewat `enabled`, bukan disimpulkan dari angka.
 *
 * Aturan cap: batas 5 untuk esai/suara HANYA berlaku kalau PG ikut aktif — PG-lah yang
 * menyerap sisanya, jadi capping tidak merusak invariant total. Kalau PG dimatikan, tipe
 * yang tersisa membagi habis `total` (user memang sengaja memilih tipe mahal itu saja).
 */
export function rebalanceQuizTypes(
  desired: QuizTypeCounts,
  total: number,
  enabled: QuizTypeEnabled
): QuizTypeCounts {
  const safeTotal = Math.max(0, Math.round(Number(total) || 0));
  if (safeTotal === 0) return { mcq: 0, essay: 0, voice: 0 };

  const activeCount = [enabled.mcq, enabled.essay, enabled.voice].filter(Boolean).length;
  // Tak ada tipe aktif sama sekali → fallback ke 100% PG (minimal 1 tipe harus aktif)
  if (activeCount === 0) return { mcq: safeTotal, essay: 0, voice: 0 };

  // SATU tipe aktif → tipe itu dapat SELURUH total, tanpa cap. Inilah yang bikin
  // "pilih salah satu saja" (100% esai / 100% esai-suara / 100% PG) jadi mungkin.
  if (activeCount === 1) {
    return {
      mcq: enabled.mcq ? safeTotal : 0,
      essay: enabled.essay ? safeTotal : 0,
      voice: enabled.voice ? safeTotal : 0,
    };
  }

  if (enabled.mcq) {
    // Campuran DENGAN PG: PG jadi penyerap sisa, jadi esai/suara aman di-cap 5.
    const room = Math.max(1, safeTotal - 1); // sisakan minimal 1 soal untuk PG
    let essay = enabled.essay ? clamp(desired.essay, 1, Math.min(MAX_SPECIAL, room)) : 0;
    let voice = enabled.voice ? clamp(desired.voice, 1, Math.min(MAX_SPECIAL, room)) : 0;
    // Gabungan esai+suara tak boleh menghabiskan jatah PG — kecilkan yang terbesar dulu.
    while (essay + voice > room) {
      if (voice >= essay && voice > 1) voice -= 1;
      else if (essay > 1) essay -= 1;
      else break;
    }
    return { mcq: Math.max(0, safeTotal - essay - voice), essay, voice };
  }

  // Campuran TANPA PG (esai + esai-suara): tidak ada penyerap sisa, jadi keduanya
  // membagi habis total — cap 5 sengaja TIDAK diterapkan di sini.
  const essay = clamp(desired.essay, 1, safeTotal - 1);
  return { mcq: 0, essay, voice: safeTotal - essay };
}

export const DEFAULT_OPTIONS: GenerateOptions = {
  quizCount: 10,
  level: "High",
  sectionCount: 10,
  quizTypes: { mcq: 10, essay: 0, voice: 0 },
};

const STORAGE_KEY = "bs.generateOptions";

/** Baca pilihan terakhir dari localStorage. Aman dipanggil di server (balik default). */
export function loadSavedOptions(): GenerateOptions {
  if (typeof window === "undefined") return DEFAULT_OPTIONS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<GenerateOptions>;
    const quizCount = Number(parsed.quizCount);
    let level: CourseLevel = "High";
    if (parsed.level === "Low" || parsed.level === "Dasar") {
      level = "Low";
    } else if (parsed.level === "High" || parsed.level === "Lanjut") {
      level = "High";
    } else {
      level = "High";
    }
    const safeQuizCount = Number.isFinite(quizCount)
      ? clamp(quizCount, 5, 15)
      : DEFAULT_OPTIONS.quizCount;
    const rawTypes = (parsed.quizTypes ?? {}) as Partial<QuizTypeCounts>;
    const savedCounts = {
      mcq: Number(rawTypes.mcq) || 0,
      essay: Number(rawTypes.essay) || 0,
      voice: Number(rawTypes.voice) || 0,
    };
    return {
      quizCount: safeQuizCount,
      sectionCount: level === "High" ? 10 : 5,
      level,
      // Fitur T — tipe aktif yang tersimpan ikut dipulihkan (termasuk "PG dimatikan").
      quizTypes: rebalanceQuizTypes(savedCounts, safeQuizCount, enabledFromCounts(savedCounts)),
    };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

/** Simpan pilihan setelah generate berhasil, supaya jadi default di pintu manapun berikutnya. */
export function saveOptions(options: GenerateOptions) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // localStorage penuh/diblokir (mode privat) — abaikan, bukan fitur kritis
  }
}

const ESTIMATE_SECONDS = { mcq: 30, essay: 120, voice: 150 };

/** Baris satu tipe soal: kartu interaktif dengan ikon, judul, deskripsi, toggle, dan kontrol angka. */
function TypeRow({
  label,
  icon,
  description,
  checked,
  count,
  max,
  onToggle,
  onCount,
  disabled,
  lockedReason,
  locked = false,
}: {
  label: string;
  icon?: string;
  description?: string;
  checked: boolean;
  count: number;
  max?: number; // undefined = angka read-only (dihitung otomatis sebagai sisa)
  onToggle: (checked: boolean) => void;
  onCount?: (n: number) => void;
  disabled?: boolean;
  lockedReason?: string; // ada = checkbox tak bisa dicentang/di-uncheck, dijelaskan lewat tooltip
  // Fitur CD — dikunci PAKET (beda dari "tipe aktif terakhir"): tampil dengan
  // lencana terpisah, bukan ditempel ke teks label (dulu bikin teks patah aneh).
  locked?: boolean;
}) {
  const editable = typeof max === "number" && checked;
  const cannotToggle = disabled || Boolean(lockedReason);

  return (
    <div
      title={lockedReason}
      className={`group relative flex flex-1 flex-col justify-between rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
        locked
          ? "border-dashed border-slate-200 bg-slate-50/70"
          : checked
            ? "border-brand-500 bg-brand-500/10 shadow-sm ring-1 ring-brand-500/20"
            : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <label className={`block ${cannotToggle ? "cursor-default" : "cursor-pointer"}`}>
        <div className="flex items-start justify-between gap-2">
          {icon ? (
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition ${
                locked
                  ? "bg-slate-200/70 text-slate-400"
                  : checked
                    ? "bg-brand-500 text-white shadow-sm"
                    : "bg-brand-500/10 text-brand-600 group-hover:bg-brand-500/20"
              }`}
            >
              <i className={`bi ${icon}`}></i>
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {locked && (
              <span className="flex items-center gap-1 rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                <i className="bi bi-lock-fill"></i>
                Berbayar
              </span>
            )}
            <input
              type="checkbox"
              checked={checked}
              disabled={cannotToggle}
              onChange={(e) => onToggle(e.target.checked)}
              className="h-4 w-4 rounded accent-brand-500 cursor-pointer disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="my-2.5">
          <p className={`text-xs sm:text-sm font-bold ${locked ? "text-slate-400" : checked ? "text-brand-700 font-bold" : "text-slate-800"}`}>
            {label}
          </p>
          {description && (
            <p className="mt-1 text-[11px] sm:text-xs leading-relaxed text-slate-500 min-h-[40px]">
              {description}
            </p>
          )}
        </div>
      </label>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/60 pt-2.5 gap-2">
        <span className="text-[11px] font-medium text-slate-500 shrink-0 whitespace-nowrap">Porsi Soal</span>
        {editable ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="number"
              min={1}
              max={max}
              value={count}
              disabled={disabled}
              onChange={(e) => onCount?.(Number(e.target.value))}
              className="h-7 w-12 rounded-lg border border-slate-200 bg-white px-1.5 text-center text-xs font-bold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
            />
            <span className="text-[11px] font-medium text-slate-500 shrink-0">soal</span>
          </div>
        ) : (
          <span
            className={`rounded-lg px-2 py-0.5 text-xs font-bold shrink-0 transition ${
              checked
                ? "bg-white text-brand-700 shadow-2xs border border-brand-200/60"
                : "text-slate-300"
            }`}
          >
            {count} soal
          </span>
        )}
      </div>
    </div>
  );
}

/** Fitur S/T — kombinasi tipe soal (PG / esai ketik / esai suara), bisa dipakai berdiri sendiri
 * (mis. di CustomQuizForm yang total soalnya beda rentang dari GenerateOptions). */
export function QuizTypeFields({
  total,
  value,
  onChange,
  disabled,
  voiceLocked = false,
}: {
  total: number;
  value: QuizTypeCounts;
  onChange: (next: QuizTypeCounts) => void;
  disabled?: boolean;
  /**
   * Fitur CD — paket belum mencakup soal jawab-suara. Hanya tampilan; server
   * (`sanitizeQuizTypes` dengan `allowVoice=false`) yang benar-benar menyaringnya,
   * karena API bisa dipanggil langsung tanpa lewat form ini.
   */
  voiceLocked?: boolean;
}) {
  const enabled = enabledFromCounts(value);
  const activeCount = [enabled.mcq, enabled.essay, enabled.voice].filter(Boolean).length;
  const isLastActive = (key: keyof QuizTypeEnabled) => enabled[key] && activeCount <= 1;
  const lockedReason = "Minimal satu tipe soal harus aktif";

  function toggle(key: keyof QuizTypeEnabled, checked: boolean) {
    if (!checked && activeCount <= 1) return; // minimal 1 tipe aktif
    const nextEnabled = { ...enabled, [key]: checked };
    // Tipe yang baru diaktifkan belum punya angka — kasih nilai awal wajar, sisanya
    // dirapikan rebalance (yang juga yang memutuskan cap-nya).
    const desired = { ...value, [key]: checked && value[key] < 1 ? Math.min(3, total) : value[key] };
    onChange(rebalanceQuizTypes(desired, total, nextEnabled));
  }

  function setCount(key: "essay" | "voice", n: number) {
    onChange(rebalanceQuizTypes({ ...value, [key]: n }, total, enabled));
  }

  // Batas angka yang boleh diketik: kalau PG aktif, esai/suara di-cap MAX_SPECIAL (PG menyerap
  // sisanya). Kalau PG mati, tipe khusus membagi habis total.
  const specialMax = enabled.mcq ? Math.min(MAX_SPECIAL, Math.max(1, total - 1)) : total - 1;

  const estimateMin = Math.max(
    1,
    Math.round(
      (value.mcq * ESTIMATE_SECONDS.mcq +
        value.essay * ESTIMATE_SECONDS.essay +
        value.voice * ESTIMATE_SECONDS.voice) /
        60
    )
  );

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-slate-700">Tipe soal</p>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <TypeRow
          label="Pilihan Ganda"
          icon="bi-ui-checks"
          description="Pertanyaan 4 opsi jawaban dengan kunci dan pembahasan otomatis."
          checked={enabled.mcq}
          count={value.mcq}
          disabled={disabled}
          onToggle={(c) => toggle("mcq", c)}
          lockedReason={isLastActive("mcq") ? lockedReason : undefined}
        />
        <TypeRow
          label="Esai (Ketik)"
          icon="bi-keyboard-fill"
          description="Uraian tertulis untuk menguji pemahaman konsep dengan rubrik penilaian AI."
          checked={enabled.essay}
          count={value.essay}
          max={activeCount > 1 ? specialMax : undefined}
          disabled={disabled}
          onToggle={(c) => toggle("essay", c)}
          onCount={(n) => setCount("essay", n)}
          lockedReason={isLastActive("essay") ? lockedReason : undefined}
        />
        <TypeRow
          label="Esai dengan Suara"
          icon="bi-mic-fill"
          description="Menjawab langsung dengan berbicara (maks 3x rekam, maks 400 karakter). Dinilai artikulasi dan kelengkapan konsep."
          checked={!voiceLocked && enabled.voice}
          count={voiceLocked ? 0 : value.voice}
          max={activeCount > 1 ? specialMax : undefined}
          disabled={disabled || voiceLocked}
          locked={voiceLocked}
          onToggle={(c) => toggle("voice", c)}
          onCount={(n) => setCount("voice", n)}
          lockedReason={
            voiceLocked
              ? "Tersedia di paket berbayar"
              : isLastActive("voice")
                ? lockedReason
                : undefined
          }
        />
      </div>
      {voiceLocked && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
          <i className="bi bi-lock-fill text-slate-400"></i>
          <span>Soal jawab-suara tersedia di paket berbayar.</span>{" "}
          <Link href="/pricing" className="font-semibold text-brand-600 hover:underline">
            Lihat paket
          </Link>
        </p>
      )}
      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-400">
        <i className="bi bi-clock-history"></i>
        <span>perkiraan {estimateMin} menit mengerjakan</span>
      </p>
    </div>
  );
}

/** Tiga kontrol setting saja (tanpa chrome modal) — dipakai inline di GeneratePanel & di modal. */
export function GenerateSettingsFields({
  value,
  onChange,
  disabled,
  voiceLocked = false,
  highLevelLocked = false,
  onHighLevelLockedClick,
}: {
  value: GenerateOptions;
  onChange: (next: GenerateOptions) => void;
  disabled?: boolean;
  voiceLocked?: boolean; // Fitur CD — paket belum mencakup soal jawab-suara
  highLevelLocked?: boolean; // Fitur 7J-GS — level High terkunci untuk non-premium / kuota habis
  onHighLevelLockedClick?: () => void;
}) {
  function setQuizCount(n: number) {
    onChange({
      ...value,
      quizCount: n,
      // Tipe yang aktif dipertahankan saat total berubah (Fitur T).
      quizTypes: rebalanceQuizTypes(value.quizTypes, n, enabledFromCounts(value.quizTypes)),
    });
  }

  return (
    <div className="space-y-6">
      {/* Baris 1: Jumlah Soal Ujian */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>Jumlah soal ujian</span>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-600">
            {value.quizCount}
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={15}
          value={value.quizCount}
          disabled={disabled}
          onChange={(e) => setQuizCount(Number(e.target.value))}
          className="w-full accent-brand-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] font-medium text-slate-400">
          <span>5</span>
          <span>15</span>
        </div>
      </div>

      {/* Baris 2: Selektor 2 Level (High vs Low) & Estimasi Subbab */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700">
            Tingkat Kedalaman & Subbab
          </label>
          <span className="text-[11px] text-slate-400 font-normal">
            Target otomatis AI per bab
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card High */}
          <div
            onClick={() => {
              if (highLevelLocked) {
                onHighLevelLockedClick?.();
                return;
              }
              if (!disabled) {
                onChange({ ...value, level: "High", sectionCount: 10 });
              }
            }}
            className={`group relative rounded-xl border p-4 text-left transition select-none ${
              highLevelLocked
                ? "border-dashed border-slate-200 bg-slate-50/70 text-slate-400 cursor-not-allowed"
                : value.level === "High"
                  ? "border-brand-500 bg-brand-50/40 ring-1 ring-brand-500 shadow-sm cursor-pointer"
                  : "border-slate-200 bg-white hover:border-slate-300 cursor-pointer hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs sm:text-sm font-bold ${
                  highLevelLocked
                    ? "text-slate-400"
                    : value.level === "High"
                      ? "text-brand-700 font-bold"
                      : "text-slate-800"
                }`}
              >
                High
              </span>
              {highLevelLocked ? (
                <span className="flex items-center gap-1 rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                  <i className="bi bi-lock-fill"></i>
                  <span>Premium</span>
                </span>
              ) : (
                <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                  8 - 12 Subbab
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Pembahasan mendalam, terperinci, dan komprehensif.
            </p>
          </div>

          {/* Card Low */}
          <div
            onClick={() => {
              if (!disabled) {
                onChange({ ...value, level: "Low", sectionCount: 5 });
              }
            }}
            className={`group relative rounded-xl border p-4 text-left transition select-none ${
              value.level === "Low"
                ? "border-brand-500 bg-brand-50/40 ring-1 ring-brand-500 shadow-sm cursor-pointer"
                : "border-slate-200 bg-white hover:border-slate-300 cursor-pointer hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs sm:text-sm font-bold ${
                  value.level === "Low" ? "text-brand-700 font-bold" : "text-slate-800"
                }`}
              >
                Low
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                4 - 7 Subbab
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Pembahasan ringkas, padat konsep, dan to-the-point.
            </p>
          </div>
        </div>

        {highLevelLocked && (
          <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
            <i className="bi bi-lock-fill text-slate-400"></i>
            <span>Level High (8 - 12 subbab) hanya tersedia untuk akun Premium dengan kuota aktif.</span>{" "}
            <Link href="/pricing" className="font-semibold text-brand-600 hover:underline">
              Lihat paket
            </Link>
          </p>
        )}
      </div>

      {/* Baris 3: Tipe Soal (MCQ, Essay, Voice) */}
      <div>
        <QuizTypeFields
          total={value.quizCount}
          value={value.quizTypes}
          onChange={(quizTypes) => onChange({ ...value, quizTypes })}
          disabled={disabled}
          voiceLocked={voiceLocked}
        />
      </div>
    </div>
  );
}

/** Modal penuh (chrome + tombol) — dipakai di kartu bab (CourseChapters) & generate ulang bab
 *  di ruang belajar (Fitur X). Prop `title`/`submitLabel`/`extraContent` opsional: kalau tidak
 *  diisi, tampilannya persis seperti sebelumnya (backward compatible). */
export function GenerateSettingsModal({
  subtitle,
  value,
  onChange,
  busy,
  error,
  suggestions,
  onPickSuggestion,
  onCancel,
  onSubmit,
  title,
  submitLabel,
  busyLabel,
  extraContent,
  voiceLocked = false,
  highLevelLocked = false,
  onHighLevelLockedClick,
}: {
  subtitle?: string;
  value: GenerateOptions;
  onChange: (next: GenerateOptions) => void;
  busy: boolean;
  error: string | null;
  suggestions?: string[];
  onPickSuggestion?: (s: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  title?: React.ReactNode;
  submitLabel?: string;
  busyLabel?: string;
  extraContent?: React.ReactNode; // slot: dirender setelah kontrol setting, sebelum pesan error
  voiceLocked?: boolean; // Fitur CD — paket belum mencakup soal jawab-suara
  highLevelLocked?: boolean; // Fitur 7J-GS — level High terkunci untuk non-premium / kuota habis
  onHighLevelLockedClick?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 sm:p-6 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-2xl lg:max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100">
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              {title ?? (
                <>
                  <i className="bi bi-gear-fill text-brand-500"></i>
                  <span>Pengaturan Generate</span>
                </>
              )}
            </h3>
            {subtitle && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Tutup modal"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <GenerateSettingsFields
          value={value}
          onChange={onChange}
          disabled={busy}
          voiceLocked={voiceLocked}
          highLevelLocked={highLevelLocked}
          onHighLevelLockedClick={onHighLevelLockedClick}
        />

        {extraContent && <div className="mt-5">{extraContent}</div>}

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            <i className="bi bi-exclamation-triangle-fill text-rose-500 shrink-0 mt-0.5"></i>
            <div className="flex-1">
              <span className="font-semibold">{error}</span>
              {suggestions && suggestions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-rose-200/60">
                  <p className="font-semibold text-rose-800 text-[11px] mb-1.5 flex items-center gap-1">
                    <i className="bi bi-lightbulb-fill text-amber-500"></i>
                    <span>Saran instruksi alternatif yang relevan:</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onPickSuggestion?.(s)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white border border-rose-300 px-2 py-0.5 text-[11px] font-medium text-rose-800 hover:bg-rose-100 transition"
                      >
                        <i className="bi bi-arrow-right-short text-rose-500"></i>
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                    <i className="bi bi-shield-check text-emerald-600"></i>
                    <span>Kuota generate babmu tidak terpotong karena materi belum diproses.</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="w-full sm:w-auto rounded-xl bg-brand-500 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>{busyLabel ?? "Menyusun materi…"}</span>
              </>
            ) : (
              <>
                <i className="bi bi-lightning-charge-fill"></i>
                <span>{submitLabel ?? "Generate Bab"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
