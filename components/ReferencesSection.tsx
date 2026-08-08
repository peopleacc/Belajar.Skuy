import type { Reference } from "@/lib/content";

// Fitur H — daftar referensi (jurnal + web) di akhir bab. Dikelompokkan per jenis,
// tiap item bisa diklik ke sumber aslinya. Tidak dirender kalau kosong.
export default function ReferencesSection({ references }: { references: Reference[] }) {
  if (!references || references.length === 0) return null;

  const journals = references.filter((r) => r.type === "jurnal");
  const web = references.filter((r) => r.type === "web");

  const Item = ({ r }: { r: Reference }) => (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-md border border-border bg-surface-2 px-4 py-3 transition hover:border-accent"
    >
      <p className="text-sm font-semibold text-slate-800">{r.title}</p>
      <p className="mt-0.5 text-xs text-slate-400">
        {[r.authors, r.year].filter(Boolean).join(" · ")}
        {(r.authors || r.year) && " · "}
        <span className="text-accent">buka sumber →</span>
      </p>
    </a>
  );

  return (
    <div className="rounded-sm bg-surface p-6 shadow-card md:p-8">
      <h3 className="text-sm font-bold uppercase tracking-wider text-accent">Referensi</h3>
      <p className="mt-1 text-xs text-slate-400">
        Sumber yang jadi dasar pembahasan bab ini (diambil otomatis, link asli).
      </p>

      {journals.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold text-slate-500">📄 Jurnal</p>
          <div className="space-y-2">
            {journals.map((r, i) => (
              <Item key={`j${i}`} r={r} />
            ))}
          </div>
        </div>
      )}

      {web.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold text-slate-500">🌐 Web</p>
          <div className="space-y-2">
            {web.map((r, i) => (
              <Item key={`w${i}`} r={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
