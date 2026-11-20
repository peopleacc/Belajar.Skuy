export default function SimulationLoading() {
  return (
    <main className="mx-auto max-w-6xl animate-pulse p-8">
      {/* ── 1. Page Header Skeleton ── */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded-xl bg-slate-200" />
          <div className="h-4 w-96 rounded-lg bg-slate-100" />
        </div>
        <div className="h-9 w-44 rounded-full bg-slate-200" />
      </div>

      {/* ── 2. Three Quick Action Cards Skeleton ── */}
      <section className="mb-8 grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-slate-200" />
              <div className="space-y-1.5">
                <div className="h-5 w-32 rounded bg-slate-200" />
                <div className="h-3 w-20 rounded bg-slate-100" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="h-3.5 w-full rounded bg-slate-100" />
              <div className="h-3.5 w-4/5 rounded bg-slate-100" />
            </div>
            <div className="h-9 w-full rounded-xl bg-slate-200" />
          </div>
        ))}
      </section>

      {/* ── 3. Analytics Widgets Skeleton ── */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-64 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="h-5 w-40 rounded bg-slate-200" />
          <div className="h-44 w-full rounded-xl bg-slate-100" />
        </div>
        <div className="h-64 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="h-5 w-36 rounded bg-slate-200" />
          <div className="h-44 w-full rounded-xl bg-slate-100" />
        </div>
      </div>

      {/* ── 4. History Table Skeleton ── */}
      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 rounded bg-slate-200" />
          <div className="h-4 w-28 rounded bg-slate-100" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3 flex gap-4">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="h-4 w-20 rounded bg-slate-200" />
            <div className="h-4 w-16 rounded bg-slate-200" />
            <div className="h-4 w-16 rounded bg-slate-200" />
            <div className="h-4 w-20 rounded bg-slate-200" />
          </div>
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="h-4 w-28 rounded bg-slate-100" />
                <div className="h-4 w-24 rounded bg-slate-100" />
                <div className="h-4 w-12 rounded bg-slate-100" />
                <div className="h-4 w-12 rounded bg-slate-100" />
                <div className="h-7 w-20 rounded-lg bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

