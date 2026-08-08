import type { Metadata } from "next";
import { cookies } from "next/headers";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { LANG_COOKIE, normalizeLang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "belajar.skuy — Belajar Apapun, Skuy!",
  description:
    "Platform kursus online bertenaga AI: generate kurikulum, materi, kuis, dan tutor chatbot pribadi.",
};

// Set tema sebelum paint (anti-FOUC): baca localStorage.theme, fallback preferensi sistem.
// Fitur DJ — mode TERANG adalah default untuk pengunjung baru. Sebelumnya ada
// fallback `matchMedia('(prefers-color-scheme: dark)')` yang membuat app ikut
// gelap kalau OS user disetel gelap — padahal itu preferensi sistem, bukan
// pilihan sadar user untuk app ini. Sekarang gelap HANYA kalau user memang
// pernah menekan tombol tema (localStorage.theme === 'dark').
const themeScript = `
(function(){try{
  if(localStorage.getItem('theme')==='dark'){
    document.documentElement.classList.add('dark');
  }
}catch(e){}})();
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `lang` ikut cookie bahasa supaya screen reader & mesin pencari membaca
  // halaman dengan bahasa yang benar (lihat lib/i18n.ts).
  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
