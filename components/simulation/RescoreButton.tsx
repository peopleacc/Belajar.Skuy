"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Fitur BD — nilai (ulang) sesi dari halaman hasil. Dipakai saat penilaian
// otomatis pasca-sesi gagal (kuota AI habis, jaringan), atau untuk menilai ulang.
export default function RescoreButton({
  sessionId,
  label = "🧮 Nilai Ulang",
}: {
  sessionId: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/simulation/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal menilai. Coba lagi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={() => void run()}
        disabled={busy}
        className="rounded-xl border border-brand-500 px-4 py-2 text-xs font-semibold text-brand-500 transition hover:bg-brand-500 hover:text-white disabled:opacity-60"
      >
        {busy ? "⏳ Menilai…" : label}
      </button>
      {error && <p className="text-[11px] text-rose-500">{error}</p>}
    </div>
  );
}
