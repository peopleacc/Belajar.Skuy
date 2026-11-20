export default function PortalLoading() {
  return (
    <div className="min-h-screen bg-dominant text-slate-800">
      {/* ── Top Navbar Placeholder ── */}
      <div className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-border/70 bg-white/70 backdrop-blur-md" />

      <main className="mx-auto max-w-7xl animate-pulse px-4 pb-24 pt-28 sm:px-6 md:px-10">
        {/* ── 1. Page Heading Skeleton ── */}
        <div className="mb-10 flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <div className="h-3.5 w-28 rounded-full bg-slate-200" />
            <div className="h-8 w-64 rounded-xl bg-slate-200" />
            <div className="h-4 w-80 rounded-lg bg-slate-100" />
          </div>
          <div className="h-9 w-36 rounded-full bg-slate-200" />
        </div>

        {/* ── 2. Mode Grid Skeleton (Kursus AI vs Simulasi AI) ── */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Card 1: Kursus AI */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-slate-200" />
              <div className="space-y-2">
                <div className="h-3 w-20 rounded-full bg-slate-200" />
                <div className="h-6 w-44 rounded-lg bg-slate-200" />
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <div className="h-3.5 w-full rounded bg-slate-100" />
              <div className="h-3.5 w-4/5 rounded bg-slate-100" />
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
              <div className="h-4 w-28 rounded bg-slate-200" />
              <div className="h-10 w-32 rounded-xl bg-slate-200" />
            </div>
          </div>

          {/* Card 2: Simulasi AI */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-slate-200" />
              <div className="space-y-2">
                <div className="h-3 w-24 rounded-full bg-slate-200" />
                <div className="h-6 w-48 rounded-lg bg-slate-200" />
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <div className="h-3.5 w-full rounded bg-slate-100" />
              <div className="h-3.5 w-4/5 rounded bg-slate-100" />
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
              <div className="h-4 w-28 rounded bg-slate-200" />
              <div className="h-10 w-32 rounded-xl bg-slate-200" />
            </div>
          </div>
        </div>

        {/* ── 3. Telemetri Kuota & Billing Skeleton ── */}
        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {/* Quota Overview Skeleton */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div className="h-5 w-40 rounded-lg bg-slate-200" />
              <div className="h-4 w-24 rounded bg-slate-200" />
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-28 rounded bg-slate-200" />
                    <div className="h-6 w-6 rounded-full bg-slate-200" />
                  </div>
                  <div className="h-3 w-16 rounded bg-slate-200" />
                  <div className="h-2 w-full rounded-full bg-slate-200" />
                </div>
              ))}
            </div>
          </div>

          {/* Subscription Details Skeleton */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="border-b border-slate-100 pb-5">
              <div className="h-5 w-36 rounded-lg bg-slate-200" />
            </div>
            <div className="mt-6 space-y-4">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-8 w-48 rounded-xl bg-slate-200" />
              <div className="h-3.5 w-full rounded bg-slate-100" />
              <div className="h-10 w-full rounded-xl bg-slate-200" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

