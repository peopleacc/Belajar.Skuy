// Fitur U — skeleton ruang belajar (2 kolom: materi + sidebar).
export default function LearnLoading() {
  return (
    <main className="mx-auto max-w-4xl animate-pulse p-8">
      <div className="mb-4 h-3 w-56 rounded bg-slate-200" />
      <div className="h-7 w-80 rounded-lg bg-slate-200" />
      <div className="mt-2 h-3 w-24 rounded bg-slate-200" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <div className="h-48 rounded-sm bg-slate-200" />
          <div className="h-80 rounded-sm bg-slate-200" />
        </div>
        <div className="space-y-4">
          <div className="h-48 rounded-sm bg-slate-200" />
          <div className="h-20 rounded-sm bg-slate-200" />
        </div>
      </div>
    </main>
  );
}
