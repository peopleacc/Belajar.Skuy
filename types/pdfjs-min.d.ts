// Deklarasi tipe untuk build MINIFIED pdf.js.
//
// `lib/slides.ts` sengaja mengimpor "pdfjs-dist/build/pdf.min.mjs", BUKAN
// "pdfjs-dist" biasa: entry non-minified (baik "pdfjs-dist", "build/pdf.mjs",
// maupun "legacy/build/pdf.mjs") gagal dimuat webpack Next.js dengan
// "TypeError: Object.defineProperty called on non-object" — diverifikasi
// langsung di browser, cuma varian .min.mjs yang berhasil.
//
// Subpath itu tidak punya berkas .d.ts sendiri (paketnya cuma menyediakan tipe
// untuk entry utama), jadi tipenya dipinjam dari "pdfjs-dist" — isinya modul
// yang sama, cuma beda hasil build.
declare module "pdfjs-dist/build/pdf.min.mjs" {
  export * from "pdfjs-dist";
}
