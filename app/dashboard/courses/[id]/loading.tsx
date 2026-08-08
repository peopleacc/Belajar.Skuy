// Fitur U — skeleton instan saat pindah ke halaman course, supaya user tidak melihat layar
// diam selama server component menunggu query Supabase.
export default function CourseLoading() {
  return (
    <main className="mx-auto max-w-5xl animate-pulse p-8">
      <div className="h-[180px] rounded-sm bg-slate-200" />
      <div className="mt-6 flex items-center justify-between">
        <div className="h-4 w-64 rounded bg-slate-200" />
        <div className="h-8 w-40 rounded-full bg-slate-200" />
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-56 rounded-sm bg-slate-200" />
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-sm bg-slate-200" />
        <div className="h-64 rounded-sm bg-slate-200" />
      </div>
    </main>
  );
}
