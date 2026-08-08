// Fitur U — skeleton Study Library.
export default function LibraryLoading() {
  return (
    <main className="mx-auto max-w-5xl animate-pulse p-8">
      <div className="h-7 w-48 rounded-lg bg-slate-200" />
      <div className="mt-2 h-3 w-72 rounded bg-slate-200" />
      <div className="mt-6 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="h-5 w-56 rounded bg-slate-200" />
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="h-32 rounded-sm bg-slate-200" />
              <div className="h-32 rounded-sm bg-slate-200" />
              <div className="h-32 rounded-sm bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
