export default function PricingLoading() {
  return (
    <div className="min-h-screen bg-[#f2f3f7] text-[#272b3f] font-sans flex flex-col">
      {/* ── Top Navbar Placeholder ── */}
      <div className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-border/70 bg-white/70 backdrop-blur-md" />

      <main className="flex-1 animate-pulse">
        {/* ── 1. Hero Spread Skeleton ── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-8 pt-24 sm:pt-28 pb-12 sm:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="h-6 w-36 rounded-full bg-slate-200" />
              <div className="h-10 sm:h-12 w-4/5 rounded-2xl bg-slate-200" />
              <div className="space-y-2 max-w-xl">
                <div className="h-4 w-full rounded-lg bg-slate-100" />
                <div className="h-4 w-5/6 rounded-lg bg-slate-100" />
              </div>
              <div className="pt-2">
                <div className="h-4 w-48 rounded bg-slate-200" />
              </div>
            </div>

            <div className="lg:col-span-5 flex justify-center">
              <div className="h-52 w-64 sm:h-64 sm:w-80 rounded-3xl bg-slate-200/80" />
            </div>
          </div>
        </section>

        {/* ── 2. Pricing Plans Skeleton ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="h-8 w-44 rounded-xl bg-slate-200" />
              <div className="h-4 w-80 rounded-lg bg-slate-100" />
            </div>
            {/* Billing toggle skeleton */}
            <div className="h-11 w-64 rounded-2xl bg-slate-200/90" />
          </div>

          {/* 4-tier Plan Cards Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-24 rounded-full bg-slate-200" />
                    <div className="h-4 w-12 rounded bg-slate-100" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-9 w-36 rounded-xl bg-slate-200" />
                    <div className="h-3 w-28 rounded bg-slate-100" />
                  </div>
                  <div className="border-t border-slate-100 pt-4 space-y-2.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div key={j} className="flex items-center gap-2.5">
                        <div className="h-4 w-4 shrink-0 rounded-full bg-slate-200" />
                        <div className="h-3.5 w-full rounded bg-slate-100" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-11 w-full rounded-2xl bg-slate-200" />
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. Comparison Matrix Preview Skeleton ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 py-12 border-t border-slate-200/80 space-y-6">
          <div className="space-y-2">
            <div className="h-3.5 w-28 rounded-full bg-slate-200" />
            <div className="h-8 w-64 rounded-xl bg-slate-200" />
            <div className="h-4 w-96 rounded-lg bg-slate-100" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4 flex justify-between gap-4">
              <div className="h-4 w-36 rounded bg-slate-200" />
              <div className="flex gap-8">
                <div className="h-4 w-16 rounded bg-slate-200" />
                <div className="h-4 w-16 rounded bg-slate-200" />
                <div className="h-4 w-16 rounded bg-slate-200" />
                <div className="h-4 w-16 rounded bg-slate-200" />
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 6 }).map((_, k) => (
                <div key={k} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="h-4 w-48 rounded bg-slate-100" />
                  <div className="flex gap-8">
                    <div className="h-4 w-16 rounded bg-slate-100" />
                    <div className="h-4 w-16 rounded bg-slate-100" />
                    <div className="h-4 w-16 rounded bg-slate-100" />
                    <div className="h-4 w-16 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

