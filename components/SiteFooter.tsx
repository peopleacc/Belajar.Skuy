import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import type { Dict } from "@/lib/i18n";

/**
 * SiteFooter - Footer Sistem Redesign (Planning 8 - Task 8A-NV)
 * - Menampilkan layout terpadu dengan watermark tipografi raksasa "belajar.skuy".
 * - Tautan navigasi modular, tombol Kembali ke Atas, dan status hak cipta.
 * - Strict Zero Emojis (Aturan F): Memakai Bootstrap Icons.
 */
export default function SiteFooter({
  t,
  anchorBase = "",
}: {
  t: Dict;
  anchorBase?: string;
  lang?: string;
}) {
  return (
    <footer className="border-t border-border/80 bg-surface px-5 pt-16 pb-12 transition-colors duration-300 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-start">
          {/* Sisi Kiri: Branding & Tagline */}
          <div className="max-w-sm space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <BrandLogo
                size="md"
                variant="dark"
                className="rounded-xl shadow-sm ring-1 ring-white/10"
              />
              <span className="text-xl font-extrabold tracking-[-0.06em] text-slate-900">
                belajar<span className="text-brand-500">.skuy</span>
              </span>
            </Link>
            <p className="text-base leading-relaxed text-slate-500">
              {t.footer.desc}
            </p>
          </div>

          {/* Sisi Kanan: Kelompok Tautan Navigasi */}
          <nav
            className="flex flex-wrap gap-12 sm:gap-20 text-sm font-semibold text-slate-600"
            aria-label="Navigasi footer"
          >
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                {t.footer.services}
              </span>
              <a
                href={`${anchorBase}#features`}
                className="transition hover:text-brand-500"
              >
                {t.nav.features}
              </a>
              <a
                href={`${anchorBase}#practice`}
                className="transition hover:text-brand-500"
              >
                Simulasi Latihan
              </a>
              <a
                href={`${anchorBase}#how`}
                className="transition hover:text-brand-500"
              >
                {t.nav.how}
              </a>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                {t.nav.pricing}
              </span>
              <Link
                href="/pricing"
                className="transition hover:text-brand-500"
              >
                Paket Belajar
              </Link>
              <Link
                href="/login"
                className="transition hover:text-brand-500"
              >
                {t.nav.login}
              </Link>
              <Link
                href="/register"
                className="transition hover:text-brand-500"
              >
                {t.nav.register}
              </Link>
            </div>
          </nav>
        </div>

        {/* Giant Typographic Watermark "belajar.skuy" */}
        <div
          className="my-10 select-none text-center font-extrabold tracking-[-0.075em] text-slate-200/60 leading-none transition-colors duration-300"
          style={{ fontSize: "clamp(46px, 11.5vw, 150px)" }}
          aria-hidden="true"
        >
          belajar.skuy
        </div>

        {/* Baris Bawah: Copyright & Kembali ke Atas */}
        <div className="flex flex-col-reverse items-center justify-between gap-4 border-t border-border/70 pt-6 sm:flex-row text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} {t.footer.copyright}
          </p>

          <div className="flex items-center gap-6">
            <Link
              href="/pricing"
              className="transition hover:text-brand-500"
            >
              {t.footer.terms}
            </Link>
            <a
              href="#main"
              className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-brand-500"
            >
              <span>Kembali ke atas</span>
              <i className="bi bi-arrow-up text-xs"></i>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
