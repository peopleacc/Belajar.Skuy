/**
 * Fitur DE (planning-update-11) — grid kartu angka ringkasan.
 *
 * Meniru pola yang sudah dipakai dashboard course (`app/dashboard/page.tsx`),
 * tapi halaman ITU sengaja TIDAK dialihkan ke komponen ini: halaman tersebut
 * sudah jalan & terverifikasi, dan menyentuhnya semata demi konsolidasi kode
 * berisiko regresi untuk manfaat kecil (pertimbangan yang sama dipakai saat
 * `scoreTrend.ts` diekstrak di planning-update-9).
 *
 * Konsekuensinya ada DUA tempat dengan gaya kartu yang sama. Kalau suatu saat
 * gayanya diubah, keduanya perlu diselaraskan manual — catatan ini ada supaya
 * hal itu tidak terlupa.
 */

export type Stat = {
  label: string;
  value: string;
  icon: string; // kelas bootstrap-icons, mis. "bi-easel2-fill"
  accent?: string; // kelas warna teks ikon
};

export default function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-sm bg-white p-5 shadow-card">
          <span className={`text-lg ${s.accent ?? "text-brand-500"}`}>
            <i className={`bi ${s.icon}`}></i>
          </span>
          <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-800">{s.value}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-400">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
