// Fitur U — skeleton daftar course.
export default function MyCourseLoading() {
  return (
    <main className="mx-auto max-w-5xl animate-pulse p-8">
      <div className="h-7 w-44 rounded-lg bg-slate-200" />
      <div className="mt-2 h-3 w-72 rounded bg-slate-200" />
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-52 rounded-sm bg-slate-200" />
        ))}
      </div>
    </main>
  );
}
