"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { parseSlideFile, type SlideDeck, MAX_SLIDES } from "@/lib/slides";
import { useSessionRecorder } from "@/components/simulation/useSessionRecorder";
import { VoiceFrequency } from "@/components/simulation/VoiceFrequency";
import { PreparationScreen } from "@/components/simulation/PreparationScreen";
import { LiveCadenceHUD } from "@/components/simulation/LiveCadenceHUD";

/**
 * Fitur BA & BB — alur lengkap sesi simulasi presentasi di browser:
 * unggah PPTX/PDF → preview → rekam narasi PER SLIDE → tiap ganti slide, segmen
 * audio dikirim untuk ditranskrip (paralel, tidak menahan slide berikutnya).
 *
 * Mesin rekam/analisis/unggah-nya ada di `useSessionRecorder` — DIPAKAI BERSAMA
 * dengan simulasi wawancara (Fitur BE) supaya perbaikan di satu sisi otomatis
 * sampai ke sisi lain.
 *
 * Privasi: file materi & frame kamera TIDAK pernah meninggalkan browser; yang
 * terkirim hanya teks slide + potongan audio (dibuang server setelah jadi teks).
 */

const MAX_SEGMENT_SECONDS = 120; // 2 menit/slide — standardisasi durasi per slide

const CARD = "rounded-sm bg-white shadow-card";

type Phase = "setup" | "preparing" | "running" | "finishing";

// Fitur DL — bahasa sesi: menentukan bahasa transkrip narasi & laporan penilaian
// akhir. Presentasi tidak punya TTS (tidak ada yang dibacakan ke user), tapi
// pilihannya tetap perlu supaya presenter berbahasa Inggris tidak dapat
// transkrip/laporan Bahasa Indonesia.
type SessionLang = "id" | "en";
const SESSION_LANGS: { value: SessionLang; label: string }[] = [
  { value: "id", label: "🇮🇩 Bahasa Indonesia" },
  { value: "en", label: "🇬🇧 Bahasa Inggris" },
];

export default function SessionRunner({
  historySlot,
  skeletonAllowed = false,
}: {
  /**
   * Fitur DF — ringkasan & riwayat sesi sebelumnya, dirender di SERVER lalu
   * dioper ke sini. Sengaja ditampilkan HANYA di fase setup: saat sesi berjalan,
   * layar harus fokus ke slide & kamera, bukan tabel skor lama.
   */
  historySlot?: React.ReactNode;
  /** Hak akses paket: apakah pengguna memiliki fitur visual kerangka kamera (premium_presentasi, gabungan, pro). */
  skeletonAllowed?: boolean;
} = {}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("setup");
  const [deck, setDeck] = useState<SlideDeck | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startNote, setStartNote] = useState("");
  const [scoring, setScoring] = useState(false);
  // Fitur BC — analisis visual bisa DIMATIKAN user (DoD), dan gagal kamera/model ≠ buntu.
  const [visualWanted, setVisualWanted] = useState(true);
  // Fitur 19 — visual kerangka pose/tangan/mata di kamera (terkunci jika non-premium)
  const [skeletonWanted, setSkeletonWanted] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);
  const [sessionLang, setSessionLang] = useState<SessionLang>("id");

  const sessionIdRef = useRef<string | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const rec = useSessionRecorder({
    maxSegmentSeconds: MAX_SEGMENT_SECONDS,
    wantVisual: visualWanted,
    language: sessionLang,
  });

  // ---- tandai 'abandoned' kalau tab ditutup di tengah sesi ----
  useEffect(() => {
    function onPageHide() {
      if (phase === "running" && sessionIdRef.current) {
        navigator.sendBeacon(
          "/api/simulation/finish",
          new Blob(
            [JSON.stringify({ action: "abandon", sessionId: sessionIdRef.current })],
            { type: "application/json" }
          )
        );
      }
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [phase]);

  // ---- lepas dokumen PDF: HANYA saat deck diganti / komponen dilepas ----
  // Dulu ini menyatu dengan listener di atas (deps [phase, deck]), sehingga
  // cleanup-nya — termasuk deck.destroy() — ikut jalan SETIAP `phase` berubah.
  // Akibatnya dokumen PDF dihancurkan tepat saat sesi dimulai (setup→running),
  // dan preview slide di fase berjalan selalu gagal dirender.
  useEffect(() => {
    return () => deck?.destroy();
  }, [deck]);

  // ---- preview PDF: render halaman aktif ke canvas ----
  // `phase` IKUT jadi dependensi: pindah fase setup→running memasang ulang elemen
  // canvas di posisi baru, jadi isinya wajib digambar ulang — tanpa ini canvasnya
  // kosong begitu sesi dimulai.
  useEffect(() => {
    if (!deck || !canvasRef.current) return;
    setRenderFailed(false);
    void deck.renderPage(index, canvasRef.current).catch(() => setRenderFailed(true));
  }, [deck, index, phase]);

  // ---- preview kamera (fase berjalan): berbagi stream dengan video analisis ----
  useEffect(() => {
    if (phase === "running" && previewRef.current && rec.camStreamRef.current) {
      previewRef.current.srcObject = rec.camStreamRef.current;
      void previewRef.current.play().catch(() => {});
      rec.setOverlayCanvas(overlayCanvasRef.current, skeletonWanted && skeletonAllowed);
    }
  }, [phase, rec, skeletonWanted, skeletonAllowed]);

  // ============ Setup ============

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setParsing(true);
    deck?.destroy();
    setDeck(null);
    try {
      const parsed = await parseSlideFile(file);
      setDeck(parsed);
      setFileName(file.name);
      setIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membaca file.");
    } finally {
      setParsing(false);
    }
  }

  async function goToPreparation() {
    if (!deck) return;
    setError(null);
    setStarting(true);

    // Izin mikrofon & kamera diminta saat persiapan
    await rec.prepareMedia(setStartNote);
    setStarting(false);
    setStartNote("");
    setPhase("preparing");
  }

  async function startOfficialSession() {
    if (!deck) return;
    setError(null);
    setStarting(true);

    try {
      setStartNote("Membuat sesi…");
      const res = await fetch("/api/simulation/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slides: deck.slides.map((s) => s.text),
          settings: {
            language: sessionLang,
            noMic: rec.noMic,
            visualEnabled: rec.visualState !== "failed" && visualWanted,
            skeletonEnabled: skeletonWanted && skeletonAllowed,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat sesi.");
        setStarting(false);
        setPhase("setup");
        return;
      }
      sessionIdRef.current = data.sessionId;
      setIndex(0);
      setPhase("running");
      rec.beginSegment();
    } catch {
      setError("Tidak bisa terhubung ke server. Coba lagi.");
      setPhase("setup");
    } finally {
      setStarting(false);
      setStartNote("");
    }
  }

  function nextSlide() {
    if (!deck) return;
    rec.closeSegment(sessionIdRef.current ?? "", index, deck.slides[index]?.imageBase64);
    setIndex((i) => i + 1);
    rec.beginSegment();
  }

  async function finish() {
    setPhase("finishing");
    // metrik dikumpulkan sebelum analyzer ditutup
    rec.closeSegment(sessionIdRef.current ?? "", index, deck?.slides[index]?.imageBase64);
    await rec.finalize();
    try {
      await fetch("/api/simulation/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finish", sessionId: sessionIdRef.current }),
      });
      // Fitur BD — nilai langsung supaya halaman hasil sudah berisi laporan.
      // Gagal menilai ≠ gagal sesi: halaman hasil punya tombol "Nilai Ulang".
      setScoring(true);
      await fetch("/api/simulation/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      }).catch(() => {});
    } catch {
      /* status tertinggal 'running' → beacon/daftar sesi yang menangani */
    }
    router.push(`/simulation/${sessionIdRef.current}`);
  }

  // ============ Tampilan ============

  const isLast = deck ? index === deck.slides.length - 1 : false;

  /**
   * Preview slide = HASIL RENDER PDF-nya, bukan teks hasil ekstraksi. Teks slide
   * tetap diambil & dikirim untuk penilaian di akhir sesi, cuma tidak ditampilkan
   * di sini — ekstraksi teks sering berantakan (mis. PDF Canva memecah huruf jadi
   * "M M E E T T O O") dan itu bukan yang dilihat audiens saat presentasi.
   *
   * Ditulis sebagai JSX BIASA, bukan komponen bersarang `function SlidePreview()`.
   * Komponen yang didefinisikan ulang tiap render punya identitas baru, sehingga
   * React membongkar-pasang ulang <canvas>-nya dan isi gambarnya hilang — dan di
   * fase berjalan itu terjadi TIAP DETIK karena timer REC memicu render.
   */
  const slidePreview = deck ? (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <canvas ref={canvasRef} className="mx-auto h-auto max-w-full rounded-lg" />
      {renderFailed && (
        <p className="mt-3 text-center text-xs italic text-slate-400">
          Halaman ini gagal ditampilkan, tapi isinya tetap ikut dinilai.
        </p>
      )}
    </div>
  ) : null;

  // ---- fase setup ----
  if (phase === "setup") {
    const card = (
      <div className={`${CARD} p-8`}>
        <h1 className="text-2xl font-bold tracking-tight">Sesi Presentasi Baru</h1>
        <p className="mt-2 text-sm text-slate-500">
          Unggah materi (.pdf, maks {MAX_SLIDES} slide). Masih punya file .pptx? Export/Save
          As PDF dulu (satu klik di PowerPoint/Google Slides/Keynote). File dibaca{" "}
          <strong>di browser-mu</strong> — tidak diunggah ke server; hanya teks slide yang
          dikirim untuk penilaian.
        </p>

        <label className="mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-6 py-10 text-center transition hover:bg-brand-50">
          <i className="bi bi-file-earmark-pdf text-3xl text-brand-500"></i>
          <span className="text-sm font-semibold text-brand-600">
            {fileName || "Pilih file .pdf"}
          </span>
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {parsing && <p className="mt-4 text-sm text-slate-500">⏳ Membaca file…</p>}
        {error && (
          <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>
        )}

        {deck && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">
                Pratinjau — slide {index + 1} / {deck.slides.length}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                  className="rounded-lg border border-border px-3 py-1 text-sm disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  onClick={() => setIndex((i) => Math.min(deck.slides.length - 1, i + 1))}
                  disabled={isLast}
                  className="rounded-lg border border-border px-3 py-1 text-sm disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </div>
            {slidePreview}

            {/* Fitur DL — bahasa sesi (transkrip narasi + laporan penilaian) */}
            <div className="mt-6 rounded-xl border border-border bg-surface-2 px-4 py-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">Bahasa sesi</p>
              <div className="flex gap-2">
                {SESSION_LANGS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setSessionLang(l.value)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      sessionLang === l.value
                        ? "border-brand-500 bg-brand-500/10 text-brand-600"
                        : "border-slate-200 text-slate-500 hover:bg-surface-2"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Bahasa yang kamu pakai saat presentasi — menentukan bahasa transkrip
                narasi dan laporan penilaiannya.
              </p>
            </div>

            {/* Fitur BC — penjelasan SEBELUM kamera menyala + tombol mematikan (DoD) */}
            <label className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
              <input
                type="checkbox"
                checked={visualWanted}
                onChange={(e) => setVisualWanted(e.target.checked)}
                className="mt-0.5 accent-brand-500"
              />
              <span className="text-xs leading-relaxed text-slate-600">
                <span className="font-semibold">Analisis penyampaian via kamera</span> — arah
                pandang, postur, dan gerak tangan dianalisis <strong>di browser-mu</strong>.
                Video tidak direkam dan tidak pernah dikirim ke server; yang terkirim hanya
                angka ringkasan (mis. “menghadap kamera 72%”). Hasilnya berupa{" "}
                <em>catatan latihan</em>, bukan penilaian pasti.
              </span>
            </label>

            {/* Fitur 19 — Pengaturan Visual Kerangka (Skeleton) Kamera */}
            <div className={`mt-3 flex items-start justify-between gap-3 rounded-xl border p-4 ${
              skeletonAllowed ? "border-slate-200 bg-surface-2" : "border-slate-200 bg-slate-50 opacity-80"
            }`}>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Visual Kerangka Kamera</span>
                  {!skeletonAllowed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      🔒 Khusus Premium Presentasi, Gabungan, &amp; Pro
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Tampilkan garis kerangka tubuh, sendi tangan, dan titik pupil iris secara visual di kamera presenter.
                </p>
              </div>
              <input
                type="checkbox"
                checked={skeletonWanted && skeletonAllowed}
                disabled={!skeletonAllowed || starting}
                onChange={(e) => setSkeletonWanted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded accent-brand-500 disabled:cursor-not-allowed"
              />
            </div>

            <button
              onClick={() => void goToPreparation()}
              disabled={starting}
              className="mt-4 w-full rounded-xl bg-brand-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
            >
              {starting ? `⏳ ${startNote || "Menyiapkan media…"}` : "👉 Lanjut ke Persiapan Simulasi"}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Izin mikrofon{visualWanted ? " & kamera" : ""} diminta saat masuk tahap persiapan. 🔒 Rekaman
              tidak disimpan — hanya transkrip & angka metriknya.
            </p>
          </div>
        )}
      </div>
    );

    return (
      <>
        {card}
        {historySlot}
      </>
    );
  }

  // ---- fase persiapan mandiri (halaman penuh, bukan modal) ----
  if (phase === "preparing") {
    return (
      <PreparationScreen
        title={fileName ? `Persiapan: ${fileName}` : "Persiapan Sesi Presentasi"}
        subtitle="Periksa kesiapan kamera dan mikrofon Anda sebelum memulai presentasi slide."
        camStream={rec.camStreamRef.current}
        micStream={rec.micStreamRef.current}
        cameraReady={rec.visualState !== "failed" && visualWanted}
        voiceReady={!rec.noMic}
        simulationReady={Boolean(deck && deck.slides.length > 0)}
        skeletonEnabled={skeletonWanted && skeletonAllowed}
        starting={starting}
        startNote={startNote}
        onStart={() => void startOfficialSession()}
        onCancel={() => setPhase("setup")}
      />
    );
  }

  // ---- fase selesai (menunggu unggahan + penilaian) ----
  if (phase === "finishing") {
    return (
      <div className={`${CARD} p-10 text-center`}>
        <p className="text-lg font-semibold">
          {scoring ? "🧮 Menilai presentasimu…" : "⏳ Menyelesaikan sesi…"}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {scoring
            ? "AI sedang membandingkan narasimu dengan isi tiap slide."
            : "Menunggu transkrip slide terakhir."}
        </p>
      </div>
    );
  }

  // ---- fase berjalan ----
  return (
    <div className={`${CARD} p-6 md:p-8`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold leading-tight">{fileName || "Sesi Presentasi"}</p>
          <p className="text-xs text-slate-400">Simulasi Presentasi</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {rec.visualState === "failed" && (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600">
              tanpa analisis visual
            </span>
          )}
          {rec.noMic ? (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600">
              tanpa mikrofon — transkrip tidak tersedia
            </span>
          ) : (
            <span className="flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 font-semibold text-rose-500">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
              REC {rec.mmss}
            </span>
          )}
        </div>
      </div>

      {/* Layout Grid Sesuai Wireframe Gambar 2 */}
      <div className="grid gap-6 lg:grid-cols-[2.2fr_1fr]">
        {/* ---- kiri: slide + navigasi + frekuensi suara masuk ---- */}
        <div className="space-y-4">
          <div>
            {slidePreview}

            {rec.capped && (
              <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                Rekaman slide ini dihentikan di batas 2 menit — narasi selanjutnya di slide
                ini tidak ikut ditranskrip. Lanjut ke slide berikutnya ya.
              </p>
            )}
            {rec.failedUploads > 0 && (
              <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
                {rec.failedUploads} segmen gagal terkirim — transkrip slide itu akan kosong
                di hasil.
              </p>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400">
                Slide {index + 1} dari {deck?.slides.length}
              </p>
              {isLast ? (
                <button
                  onClick={() => void finish()}
                  className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
                >
                  ✅ Selesaikan Presentasi
                </button>
              ) : (
                <button
                  onClick={nextSlide}
                  className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
                >
                  Slide Berikutnya →
                </button>
              )}
            </div>
          </div>

          {/* Kotak Bawah Kiri: Frekuensi Suara Masuk (Wireframe Gambar 2) */}
          {!rec.noMic && (
            <div className="rounded-xl border border-slate-200 bg-surface-2 p-3.5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  🎙️ Frekuensi Suara Masuk
                </p>
                <span className="text-[10px] text-emerald-600 font-semibold">● Audio Live</span>
              </div>
              <VoiceFrequency stream={rec.micStreamRef.current} variant="inline" />
            </div>
          )}
        </div>

        {/* ---- kanan: presenter view + live cadence HUD ---- */}
        <div className="space-y-4">
          {rec.visualState === "on" && (
            <div className="rounded-xl border border-border bg-surface-2 p-3">
              <p className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Presenter View
                {skeletonWanted && skeletonAllowed && (
                  <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[9px] font-semibold text-brand-600">
                    Kerangka Aktif
                  </span>
                )}
              </p>
              <div className="relative mt-2">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={previewRef}
                  muted
                  playsInline
                  className="w-full -scale-x-100 rounded-lg border border-border object-cover"
                />
                <canvas
                  ref={overlayCanvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover"
                />
                <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" /> Presenting
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-slate-400">
                📷 Dianalisis di browser — tidak direkam &amp; tidak dikirim.
              </p>
            </div>
          )}

          {/* Fitur Update 19: Live Cadence / Realtime WPS Tracker HUD */}
          <LiveCadenceHUD cadence={rec.cadence} />
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-400">
        <Link href="/simulation" className="underline">
          Batalkan sesi
        </Link>{" "}
        · tiap ganti slide, narasinya langsung ditranskrip di latar belakang
      </p>
    </div>
  );
}
