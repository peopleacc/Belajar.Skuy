// Fitur BA (planning-update-newfitur), direvisi Fitur DA & DB (planning-update-10) —
// bongkar materi presentasi DI BROWSER. File TIDAK PERNAH diunggah ke server; yang
// keluar dari modul ini cuma teks per slide + (Fitur DB) gambar halaman berskala kecil,
// dikirim per-slide lewat /segment — bukan file aslinya.
//
// PDF-only (keputusan Fitur DA) — dirender per halaman lewat pdf.js, pixel-perfect,
// tanpa dua jalur render yang beda kesetiaan visualnya. PPTX pernah didukung (jalur
// JSZip, ekstrak teks+gambar mentah tanpa rendering engine) tapi dihapus total supaya
// tampilan presentasi konsisten satu jalur saja — user export ke PDF dulu sebelum unggah.

export const MAX_SLIDES = 20; // sinkron dengan MAX_SLIDES di service/routes/simulation.js

// Sisi terpanjang gambar yang dikirim ke AI (Fitur DB) — cukup utk Gemini menangkap
// isi chart/diagram, sengaja JAUH di bawah resolusi render layar (biar payload kecil).
const AI_IMAGE_MAX_SIDE = 1024;

export type ParsedSlide = {
  text: string;
  /** Base64 (tanpa prefix data:) gambar halaman, downscale ~1024px — Fitur DB. Null kalau gagal dirender. */
  imageBase64: string | null;
};

export type SlideDeck = {
  slides: ParsedSlide[];
  /** Render halaman PDF ke canvas — dipakai preview per-slide. */
  renderPage: (index: number, canvas: HTMLCanvasElement) => Promise<void>;
  /** Lepas dokumen. Panggil saat deck dibuang. */
  destroy: () => void;
};

const RENDER_TIMEOUT_MS = 15_000;

async function renderSlideImage(page: Awaited<ReturnType<import("pdfjs-dist").PDFDocumentProxy["getPage"]>>): Promise<string | null> {
  const task = { cancel: () => {} };
  try {
    const base = page.getViewport({ scale: 1 });
    const scale = AI_IMAGE_MAX_SIDE / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas"); // offscreen — tidak pernah dipasang ke DOM
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render pdf.js dijadwalkan lewat requestAnimationFrame, yang BERHENTI kalau tab
    // disembunyikan/di-minimize — tanpa batas waktu, unggahan bisa menggantung
    // selamanya (bukan gagal, jadi try/catch saja tidak menolong). Lewat batas →
    // slide ini jalan tanpa gambar, konsisten dengan DoD DB: gagal gambar ≠ gagal sesi.
    const render = page.render({ canvas, viewport });
    task.cancel = () => render.cancel();
    await Promise.race([
      render.promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("render timeout")), RENDER_TIMEOUT_MS)
      ),
    ]);

    // Kualitas diturunkan (0.7) — cukup buat AI menangkap isi visual, bukan buat ditampilkan.
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    return dataUrl.split(",")[1] ?? null;
  } catch {
    // Gagal render gambar SATU slide ≠ gagal parse — skor nanti jalan pakai teks saja (DoD DB).
    task.cancel();
    return null;
  }
}

async function parsePdf(file: File): Promise<SlideDeck> {
  // WAJIB varian .min.mjs — entry non-minified ("pdfjs-dist", "build/pdf.mjs",
  // "legacy/build/pdf.mjs") GAGAL dimuat webpack Next.js dengan "TypeError:
  // Object.defineProperty called on non-object". Diverifikasi langsung di browser:
  // dari empat jalur impor yang dicoba, cuma yang minified ini berhasil. Tipenya
  // dideklarasikan di types/pdfjs-min.d.ts. Jangan "dirapikan" jadi "pdfjs-dist".
  const pdfjs = await import("pdfjs-dist/build/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  // Pemuatan dokumen dibungkus terpisah supaya error internal pdf.js yang kriptik
  // tidak bocor mentah-mentah ke user.
  //
  // Aset di /public/pdfjs disalin dari paket npm (pola sama dengan /public/mediapipe):
  // font standar, CMap (font CID/Type0), dan wasm (gambar JPEG2000/JBIG2). pdf.js
  // mengambilnya HANYA saat sebuah PDF memang membutuhkannya, jadi tidak membebani
  // PDF sederhana. Tanpa ini, PDF yang memakai font tak-tertanam bisa gagal render
  // dengan cara yang sulit dilacak.
  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: await file.arrayBuffer(),
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      wasmUrl: "/pdfjs/wasm/",
      iccUrl: "/pdfjs/iccs/",
    }).promise;
  } catch {
    throw new Error(
      "Gagal membaca file PDF ini — kemungkinan berkasnya rusak, terkunci password, " +
        "atau memakai elemen yang tidak didukung. Coba export/simpan ulang PDF-nya, " +
        "lalu unggah lagi."
    );
  }
  if (doc.numPages > MAX_SLIDES) {
    throw new Error(`Maksimal ${MAX_SLIDES} halaman — file ini berisi ${doc.numPages}.`);
  }

  // Tahap 1 — teks semua halaman dulu. Dipisah dari render gambar (tahap 2) dan
  // dibungkus PER HALAMAN: satu halaman gagal dibaca (mis. konten PDF yang aneh)
  // tidak boleh menggagalkan seluruh upload — sebelumnya ini TIDAK dilindungi,
  // jadi satu halaman bermasalah bikin seluruh unggahan gagal total.
  const slides: ParsedSlide[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      slides.push({ text, imageBase64: null });
    } catch {
      slides.push({ text: "", imageBase64: null });
    }
  }

  // Tahap 2 — gambar tiap halaman (Fitur DB), belakangan & terpisah dari ekstraksi
  // teks di atas. Gagal di sini (satu atau semua halaman) TIDAK BOLEH menggagalkan
  // upload — presentasi tetap bisa dimulai, skor nanti jalan pakai teks saja.
  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      slides[i - 1].imageBase64 = await renderSlideImage(page);
    } catch {
      /* dibiarkan null */
    }
  }

  // Render preview yang sedang berjalan — dibatalkan kalau ada permintaan baru.
  // Tanpa ini, dua render yang tumpang tindih (mis. user cepat menekan ←/→, atau
  // pindah fase saat render sebelumnya belum kelar) bisa saling menimpa dan
  // menyisakan canvas kosong.
  let activeRender: { cancel: () => void } | null = null;

  return {
    slides,
    renderPage: async (index, canvas) => {
      activeRender?.cancel();
      activeRender = null;

      const page = await doc.getPage(index + 1);
      const viewport = page.getViewport({ scale: 1.2 });
      canvas.width = viewport.width; // mengubah ukuran JUGA mengosongkan canvas
      canvas.height = viewport.height;

      // Pakai `canvas` saja — di pdf.js v5 `canvasContext` cuma jalur kompatibilitas
      // lama yang mensyaratkan `canvas: null`. Mengirim KEDUANYA (seperti sebelumnya)
      // di luar kontrak API dan perilakunya tidak dijamin.
      const task = page.render({ canvas, viewport });
      activeRender = task;
      try {
        await task.promise;
      } catch (err) {
        // Pembatalan itu normal (ada render lebih baru) — bukan kegagalan yang
        // perlu dilaporkan ke pemanggil.
        if ((err as { name?: string })?.name !== "RenderingCancelledException") throw err;
      } finally {
        if (activeRender === task) activeRender = null;
      }
    },
    destroy: () => {
      activeRender?.cancel();
      void doc.destroy();
    },
  };
}

export async function parseSlideFile(file: File): Promise<SlideDeck> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return parsePdf(file);
  throw new Error("Format tidak didukung — unggah file .pdf (export dulu dari PowerPoint/Google Slides/Keynote kalau materimu masih .pptx).");
}
