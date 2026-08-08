import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

// Halaman "My Course": tiap COURSE (modul) jadi kartu (gaya mockup). Klik kartu → learning path.
// Progress dihitung PER BAB (bukan per sub-bab): bar maju saat satu bab tuntas (kuis lulus),
// dibagi TOTAL bab course — jadi bab yang belum digenerate ikut jadi penyebut (belum selesai).

type Chapter = {
  id: string;
  body: { status?: string } | null;
};
type Module = {
  id: string;
  title: string;
  description: string | null;
  total_chapters: number;
  created_at: string;
  image_url: string | null;
  contents: Chapter[];
};

const PASS_SCORE = 70;

function isGenerated(body: Chapter["body"]) {
  return body != null && body.status !== "pending";
}

const HEADER_GRADIENTS = [
  "from-brand-400 to-brand-700",
  "from-brand-500 to-secondary",
  "from-brand-600 to-brand-900",
  "from-accent to-brand-800",
];

export default async function MyCoursePage() {
  const configured = supabaseConfigured;
  let modules: Module[] = [];
  const passed = new Set<string>(); // content_id bab yang kuisnya sudah lulus (bab tuntas)

  if (configured) {
    const supabase = await createClient();
    const [{ data: mods }, { data: attempts }] = await Promise.all([
      supabase
        .from("modules")
        .select("id, title, description, total_chapters, created_at, image_url, contents(id, body)")
        .gt("total_chapters", 0)
        .order("created_at", { ascending: false }),
      supabase.from("quiz_attempts").select("score, quizzes(content_id)"),
    ]);
    modules = (mods ?? []) as unknown as Module[];
    for (const a of (attempts ?? []) as any[]) {
      const cid = a.quizzes?.content_id;
      if (a.score >= PASS_SCORE && cid) passed.add(cid);
    }
  }

  // Progress course = jumlah bab TUNTAS (kuis lulus) / TOTAL bab course.
  function courseProgress(mod: Module) {
    const totalChapters = mod.total_chapters || (mod.contents?.length ?? 0);
    let completedChapters = 0;
    for (const ch of mod.contents ?? []) {
      if (isGenerated(ch.body) && passed.has(ch.id)) completedChapters++;
    }
    const percent =
      totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;
    return { percent, completedChapters, totalChapters };
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-bold tracking-tight">My Course</h1>
      <p className="mt-1 text-sm text-slate-500">
        Semua course-mu. Klik salah satu untuk membuka learning path-nya.
      </p>

      {!configured && (
        <div className="mt-6 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-700">
          ⚠ Supabase belum dikonfigurasi — isi <code className="font-mono">next/.env.local</code>.
        </div>
      )}

      {configured && modules.length === 0 ? (
        <div className="mt-8 rounded-sm border-2 border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
          <p className="text-2xl">📚</p>
          <p className="mt-2 font-semibold text-slate-700">Belum ada course</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
            Buat course pertamamu lewat{" "}
            <Link href="/dashboard/generate" className="font-semibold text-brand-500 hover:underline">
              Generate Course
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod, mi) => {
            const { percent, completedChapters, totalChapters } = courseProgress(mod);
            const completed = totalChapters > 0 && completedChapters >= totalChapters;
            const started = completedChapters > 0;
            return (
              <Link
                key={mod.id}
                href={`/dashboard/courses/${mod.id}`}
                className="group flex flex-col overflow-hidden rounded-sm bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div
                  className={`relative flex h-24 items-start justify-between overflow-hidden p-3 ${mod.image_url ? "" : `bg-gradient-to-br ${HEADER_GRADIENTS[mi % HEADER_GRADIENTS.length]}`
                    }`}
                >
                  {mod.image_url && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mod.image_url}
                        alt={mod.title}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute inset-0 bg-ink-900/25" />
                    </>
                  )}
                  <span className="relative rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                    {mod.total_chapters} bab
                  </span>
                  {completed && (
                    <span className="relative rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-bold text-white">
                      ✓ Selesai
                    </span>
                  )}
                  {!started && !completed && (
                    <span className="relative rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold text-ink-900">
                      NEW
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="line-clamp-1 font-bold">{mod.title}</h3>
                  <p className="mt-1 line-clamp-2 flex-1 text-xs text-slate-400">
                    {mod.description ?? "Kurikulum hasil generate AI."}
                  </p>

                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-400">
                      <span>
                        {completedChapters}/{totalChapters} bab selesai
                      </span>
                      <span>{percent}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-brand-500 transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <span className="mt-4 inline-block rounded-xl bg-brand-500 px-4 py-2 text-center text-xs font-semibold text-white shadow-lg shadow-brand-500/25 transition group-hover:bg-brand-600">
                    {completed ? "Tinjau Ulang" : started ? "Lanjutkan" : "Mulai Belajar"}
                  </span>
                </div>
              </Link>
            );
          })}

          {/* Kartu tambah course baru dengan AI */}
          <Link
            href="/dashboard/generate"
            className="group flex flex-col justify-between rounded-sm bg-secondary p-5 text-dark shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-light/10 text-lg">
                ✨
              </span>
              <h3 className="mt-3 font-bold leading-snug">Ingin Menambah Course Baru?</h3>
              <p className="mt-1 text-xs leading-relaxed text-light-muted">
                Berikan topik ke AI untuk menyusun course baru sesuai kebutuhanmu.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center justify-center gap-1 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition group-hover:bg-brand-600">
              + Tambah dengan AI
            </span>
          </Link>
        </div>
      )}
    </main>
  );
}
