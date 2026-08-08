"use client";

import { useEffect, useState } from "react";

// Fitur D — toggle tema terang/gelap. Menyalakan/mematikan class `dark` di <html>
// (fondasi token sudah dari Batch 1) + persist ke localStorage.theme.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* localStorage tak tersedia → abaikan */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      title={dark ? "Mode terang" : "Mode gelap"}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-slate-600 transition hover:bg-surface-2"
    >
      {/* Hindari kedip ikon sebelum mount (tema dibaca client-side) */}
      <span className="text-sm">
        {mounted ? (
          dark ? (
            <i className="bi bi-sun-fill"></i>
          ) : (
            <i className="bi bi-moon-fill"></i>
          )
        ) : (
          <i className="bi bi-moon-fill"></i>
        )}
      </span>
    </button>
  );
}
