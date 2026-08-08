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

export type GenerateOptions = {
  quizCount: number;
  level: string;
  sectionCount: number;
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
  level: "Menengah",
  sectionCount: 4,
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
    const sectionCount = Number(parsed.sectionCount);
    const level = ["Dasar", "Menengah", "Lanjut"].includes(parsed.level as string)
      ? (parsed.level as string)
      : DEFAULT_OPTIONS.level;
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
      sectionCount: Number.isFinite(sectionCount)
        ? clamp(sectionCount, 2, 8)
        : DEFAULT_OPTIONS.sectionCount,
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

/** Baris satu tipe soal: checkbox + angka (read-only kalau jumlahnya ditentukan otomatis). */
function TypeRow({
  label,
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
  return (
    <label
      title={lockedReason}
      className={`flex flex-1 cursor-pointer flex-col gap-2 rounded-xl border p-3 text-xs transition ${
        locked
          ? "border-dashed border-slate-200 bg-slate-50/70"
          : checked
            ? "border-brand-200 bg-brand-50/40"
            : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <span className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled || Boolean(lockedReason)}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-px shrink-0 accent-brand-500"
        />
        <span className={`leading-snug font-medium ${locked ? "text-slate-400" : "text-slate-700"}`}>
          {label}
        </span>
      </span>
      <span className="flex items-center justify-between">
        {locked && (
          <span className="flex items-center gap-1 rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            <i className="bi bi-lock-fill"></i>
            Berbayar
          </span>
        )}
        {!locked && <span />}
        {editable ? (
          <input
            type="number"
            min={1}
            max={max}
            value={count}
            disabled={disabled}
            onChange={(e) => onCount?.(Number(e.target.value))}
            className="w-10 rounded-lg border border-slate-200 px-1.5 py-1 text-center outline-none transition focus:border-brand-400 disabled:opacity-50"
          />
        ) : (
          <span
            className={`w-10 rounded-lg px-1.5 py-1 text-center font-semibold ${
              checked ? "bg-white text-slate-600" : "text-slate-300"
            }`}
          >
            {count}
          </span>
        )}
      </span>
    </label>
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
      <p className="mb-1.5 text-xs font-semibold text-slate-600">Tipe soal</p>
      <div className="flex w-full flex-row gap-2">
        <TypeRow
          label="Pilihan Ganda"
          checked={enabled.mcq}
          count={value.mcq}
          disabled={disabled}
          onToggle={(c) => toggle("mcq", c)}
          lockedReason={isLastActive("mcq") ? lockedReason : undefined}
        />
        <TypeRow
          label="Esai (ketik)"
          checked={enabled.essay}
          count={value.essay}
          max={activeCount > 1 ? specialMax : undefined}
          disabled={disabled}
          onToggle={(c) => toggle("essay", c)}
          onCount={(n) => setCount("essay", n)}
          lockedReason={isLastActive("essay") ? lockedReason : undefined}
        />
        <TypeRow
          label="Esai dengan suara 🎙️"
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
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <i className="bi bi-lock-fill"></i>
          Soal jawab-suara tersedia di paket berbayar.{" "}
          <Link href="/pricing" className="font-semibold text-brand-500 hover:underline">
            Lihat paket
          </Link>
        </p>
      )}
      <p className="mt-2 text-[11px] text-slate-400">⏱ perkiraan {estimateMin} menit mengerjakan</p>
    </div>
  );
}

/** Tiga kontrol setting saja (tanpa chrome modal) — dipakai inline di GeneratePanel & di modal. */
export function GenerateSettingsFields({
  value,
  onChange,
  disabled,
  voiceLocked = false,
}: {
  value: GenerateOptions;
  onChange: (next: GenerateOptions) => void;
  disabled?: boolean;
  voiceLocked?: boolean; // Fitur CD — paket belum mencakup soal jawab-suara
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
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      <div>
        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
          <span>Jumlah soal ujian</span>
          <span className="text-brand-600">{value.quizCount}</span>
        </div>
        <input
          type="range"
          min={5}
          max={15}
          value={value.quizCount}
          disabled={disabled}
          onChange={(e) => setQuizCount(Number(e.target.value))}
          className="w-full accent-brand-500"
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>5</span>
          <span>15</span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          Level penjelasan
        </label>
        <div className="flex gap-2">
          {["Dasar", "Menengah", "Lanjut"].map((l) => (
            <button
              key={l}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, level: l })}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                value.level === l
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-slate-500 hover:bg-surface-2"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="sm:col-span-2">
        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
          <span>Jumlah pembagian subbab</span>
          <span className="text-brand-600">{value.sectionCount}</span>
        </div>
        <input
          type="range"
          min={2}
          max={8}
          value={value.sectionCount}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, sectionCount: Number(e.target.value) })}
          className="w-full accent-brand-500"
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>2</span>
          <span>8</span>
        </div>
      </div>

      <div className="sm:col-span-2">
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
  onCancel,
  onSubmit,
  title,
  submitLabel,
  busyLabel,
  extraContent,
  voiceLocked = false,
}: {
  subtitle?: string;
  value: GenerateOptions;
  onChange: (next: GenerateOptions) => void;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void;
  title?: string;
  submitLabel?: string;
  busyLabel?: string;
  extraContent?: React.ReactNode; // slot: dirender setelah kontrol setting, sebelum pesan error
  voiceLocked?: boolean; // Fitur CD — paket belum mencakup soal jawab-suara
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-sm bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">
            {title ?? (
              <>
                <i className="bi bi-gear-fill mr-1"></i> Pengaturan Generate
              </>
            )}
          </h3>
          <button
            onClick={onCancel}
            disabled={busy}
            className="text-slate-400 transition hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        {subtitle && <p className="mb-4 line-clamp-1 text-xs text-slate-400">{subtitle}</p>}

        <GenerateSettingsFields
          value={value}
          onChange={onChange}
          disabled={busy}
          voiceLocked={voiceLocked}
        />

        {extraContent && <div className="mt-5">{extraContent}</div>}

        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-surface-2 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onSubmit}
            disabled={busy}
            className="rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? busyLabel ?? "⏳ Menyusun materi…" : submitLabel ?? "⚡ Generate Bab"}
          </button>
        </div>
      </div>
    </div>
  );
}
