export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-5xl animate-pulse p-8">
      <div className="mb-6 h-8 w-48 rounded-lg bg-slate-200" />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="h-64 rounded-sm bg-slate-200" />
        <div className="h-64 rounded-sm bg-slate-200" />
      </div>
      <div className="mt-8 h-6 w-32 rounded-lg bg-slate-200" />
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-56 rounded-sm bg-slate-200" />
        <div className="h-56 rounded-sm bg-slate-200" />
        <div className="h-56 rounded-sm bg-slate-200" />
      </div>
    </main>
  );
}
