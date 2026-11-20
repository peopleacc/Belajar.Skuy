import Image from "next/image";

export type BrandLogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "dark" | "light" | "auto";
  className?: string;
  imgClassName?: string;
  priority?: boolean;
};

const SIZES = {
  sm: { box: "h-8 w-8", px: 32 },
  md: { box: "h-10 w-10", px: 40 },
  lg: { box: "h-12 w-12", px: 48 },
  xl: { box: "h-16 w-16", px: 64 },
};

/**
 * Komponen Logo Resmi belajar.skuy:
 * Menggunakan aset logo baru (buku terbuka dengan inisial 'b' spiral modern).
 * - "dark": Varian background navy dengan garis buku putih/krem (default emblem mewah).
 * - "light": Varian background putih bersih dengan garis buku navy.
 * - "auto": Adaptif otomatis mengikuti mode terang/gelap sistem.
 */
export default function BrandLogo({
  size = "md",
  variant = "dark",
  className = "",
  imgClassName = "",
  priority = false,
}: BrandLogoProps) {
  const { box, px } = SIZES[size] || SIZES.md;

  if (variant === "auto") {
    return (
      <div
        className={`relative flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm transition-transform duration-200 ${className}`}
      >
        <Image
          src="/images/logo-dark.png"
          alt="belajar.skuy logo"
          width={px}
          height={px}
          className={`h-full w-full object-cover ${imgClassName}`}
          priority={priority}
        />
      </div>
    );
  }

  const src = variant === "light" ? "/images/logo-light.png" : "/images/logo-dark.png";

  return (
    <div
      className={`relative flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm transition-transform duration-200 ${className}`}
    >
      <Image
        src={src}
        alt="belajar.skuy logo"
        width={px}
        height={px}
        className={`h-full w-full object-cover ${imgClassName}`}
        priority={priority}
      />
    </div>
  );
}
