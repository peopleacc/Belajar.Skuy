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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `lang` ikut cookie bahasa supaya screen reader & mesin pencari membaca
  // halaman dengan bahasa yang benar (lihat lib/i18n.ts).
  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);

  return (
    <html lang={lang} suppressHydrationWarning>
      <head />
      <body>{children}</body>
    </html>
  );
}
