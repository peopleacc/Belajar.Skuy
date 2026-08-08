"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";

// Pemilih bahasa ID / EN. Bahasa ditulis ke cookie lalu router.refresh() supaya
// server component me-render ulang dengan kamus yang benar. State lokal dipakai
// agar highlight tombol berpindah seketika (tidak menunggu refresh selesai).
export default function LanguageToggle({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Lang>(lang);
  const [pending, startTransition] = useTransition();

  function pick(next: Lang) {
    if (next === current) return;
    setCurrent(next);
    // max-age 1 tahun; SameSite=Lax cukup karena hanya preferensi tampilan.
    document.cookie = `${LANG_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => router.refresh());
  }

  const item = (value: Lang, label: string) => (
    <button
      onClick={() => pick(value)}
      aria-pressed={current === value}
      className={`rounded-md px-2 py-0.5 text-xs font-bold transition ${
        current === value
          ? "bg-brand-500 text-white"
          : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className={`flex items-center gap-1 rounded-xl border border-border bg-surface p-1 transition ${
        pending ? "opacity-60" : ""
      }`}
    >
      {item("id", "ID")}
      {item("en", "EN")}
    </div>
  );
}
