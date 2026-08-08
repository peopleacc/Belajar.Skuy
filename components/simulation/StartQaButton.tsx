"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Fitur BF — mulai sesi tanya-jawab dari hasil presentasi. Server menyusun
 * pertanyaan dari ringkasan laporan (Fitur BD) lalu membuat sesi wawancara baru;
 * tombol ini cuma memicunya dan mengantar user ke sesi itu.
 */
export default function StartQaButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/simulation/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, questionCount: 4 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal memulai tanya-jawab.");
        return;
      }
      router.push(`/simulation/run/${data.sessionId}`);
    } catch {
      setError("Tidak bisa terhubung ke server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={() => void run()}
        disabled={busy}
        className="rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? "⏳ Menyusun pertanyaan…" : "🙋 Mulai Sesi Tanya-Jawab"}
      </button>
      {error && <p className="text-[11px] text-rose-500">{error}</p>}
    </div>
  );
}
