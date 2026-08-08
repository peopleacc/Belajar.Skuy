// Fitur U/V — halaman generate kini async (query judul course untuk menyaring rekomendasi),
// jadi ikut dapat skeleton supaya tidak ada layar diam saat pindah ke sini.
export default function GenerateLoading() {
  return (
    <main className="mx-auto max-w-3xl animate-pulse p-8">
      <div className="h-7 w-52 rounded-lg bg-slate-200" />
      <div className="mt-2 h-3 w-80 rounded bg-slate-200" />
      <div className="mt-6 h-72 rounded-sm bg-slate-200" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="h-32 rounded-sm bg-slate-200" />
        <div className="h-32 rounded-sm bg-slate-200" />
      </div>
    </main>
  );
}
