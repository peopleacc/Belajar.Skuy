import Link from "next/link";
import { cookies } from "next/headers";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import ProgressChart, { type ChartPoint } from "@/components/ProgressChart";
import { LANG_COOKIE, getDict, normalizeLang } from "@/lib/i18n";

// Dashboard analitik. TAMPILAN mengikuti mockup, tapi seluruh angka dihitung dari data asli
// (quiz_attempts, modules, content_progress). Metrik yang tak punya data (jam belajar, sertifikat)
// diganti metrik nyata supaya tidak menampilkan angka palsu.

type Attempt = {
  score: number;
  submitted_at: string;
  quizzes: { content_id: string | null; contents: { module_id: string } | null } | null;
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const DAY_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const PASS_SCORE = 70;
const HEADER_GRADIENTS = [
  "from-brand-400 to-brand-700",
  "from-brand-500 to-secondary",
  "from-brand-600 to-brand-900",
  "from-accent to-brand-800",
];

type Chapter = {
  id: string;
};


async function getData() {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: modules }, { data: attemptsRaw }, { data: progress }] =
    await Promise.all([
      user
        ? supabase.from("profiles").select("full_name, username").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("modules")
        .select("id, title, description, total_chapters, created_at, image_url, contents(id)")
        .gt("total_chapters", 0)
        .order("created_at", { ascending: false }),
      supabase
        .from("quiz_attempts")
        .select("score, submitted_at, quizzes(content_id, contents(module_id))"),
      supabase.from("content_progress").select("content_id, current_step"),
    ]);

  const attempts = (attemptsRaw ?? []) as unknown as Attempt[];
  const mods = (modules ?? []) as {
    id: string;
    title: string;
    total_chapters: number;
    image_url: string | null;
  }[];

  // Metrik ringkas
  const coursesCount = mods.length;
  const avgScore =
    attempts.length > 0
      ? attempts.reduce((s, a) => s + Number(a.score), 0) / attempts.length
      : 0;
  const chaptersStudied = new Set(
    (progress ?? [])
      .filter((p: any) => (p.current_step ?? 0) > 0)
      .map((p: any) => p.content_id)
  ).size;

  // Hitung bab tuntas (kuis lulus >= PASS_SCORE)
  const passed = new Set<string>();
  for (const a of (attemptsRaw ?? []) as any[]) {
    const cid = a.quizzes?.content_id;
    if (Number(a.score) >= PASS_SCORE && cid) passed.add(cid);
  }

  function courseProgress(mod: any) {
    const totalChapters = mod.total_chapters || (mod.contents?.length ?? 0);
    let completedChapters = 0;
    for (const ch of mod.contents ?? []) {
      if (passed.has(ch.id)) completedChapters++;
    }
    const percent = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;
    const completed = totalChapters > 0 && completedChapters >= totalChapters;
    const started = completedChapters > 0;
    return { percent, completedChapters, totalChapters, completed, started };
  }

  const coursesWithProgress = (mods as any[]).slice(0, 5).map((m) => ({
    ...m,
    ...courseProgress(m),
  }));

  // Streak harian
  const dateSet = new Set(attempts.map((a) => ymd(new Date(a.submitted_at))));
  let streak = 0;
  const cur = new Date();
  if (!dateSet.has(ymd(cur))) cur.setDate(cur.getDate() - 1);
  while (dateSet.has(ymd(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }

  // Rata-rata nilai per modul (untuk "Average Grades")
  const modTitle = new Map(mods.map((m) => [m.id, m.title]));
  const perMod = new Map<string, { sum: number; n: number }>();
  for (const a of attempts) {
    const mid = a.quizzes?.contents?.module_id;
    if (!mid) continue;
    const cur2 = perMod.get(mid) ?? { sum: 0, n: 0 };
    cur2.sum += Number(a.score);
    cur2.n += 1;
    perMod.set(mid, cur2);
  }
  const grades = [...perMod.entries()]
    .map(([mid, v]) => ({ title: modTitle.get(mid) ?? "Materi", avg: Math.round(v.sum / v.n) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 4);

  // Deret waktu (cumulative average skor) untuk grafik
  const sorted = attempts
    .map((a) => ({ t: new Date(a.submitted_at).getTime(), s: Number(a.score) }))
    .sort((x, y) => x.t - y.t);
  const cumAvg = (tEnd: number) => {
    let sum = 0;
    let c = 0;
    for (const p of sorted) {
      if (p.t <= tEnd) {
        sum += p.s;
        c++;
      } else break;
    }
    return c ? Math.round(sum / c) : 0;
  };
  const endOfDay = (d: Date) => {
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    return e.getTime();
  };
  const week: ChartPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    week.push({ label: DAY_ID[d.getDay()], value: cumAvg(endOfDay(d)) });
  }
  const month: ChartPoint[] = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    month.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, value: cumAvg(endOfDay(d)) });
  }

  // Heatmap frekuensi belajar (35 hari terakhir), count attempt per hari
  const countByDay = new Map<string, number>();
  for (const a of attempts) {
    const k = ymd(new Date(a.submitted_at));
    countByDay.set(k, (countByDay.get(k) ?? 0) + 1);
  }
  const heat: { key: string; count: number }[] = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = ymd(d);
    heat.push({ key: k, count: countByDay.get(k) ?? 0 });
  }

  const name =
    (profile as any)?.full_name || (profile as any)?.username || user?.email?.split("@")[0] || "Learner";

  return {
    name,
    coursesCount,
    avgScore,
    chaptersStudied,
    streak,
    grades,
    week,
    month,
    heat,
    courses: coursesWithProgress,
    hasAttempts: attempts.length > 0,
  };
}

const GRADE_COLORS = ["bg-brand-500", "bg-brand-700", "bg-accent", "bg-brand-400"];

export default async function DashboardPage() {
  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  const t = getDict(lang).dashboard;
  const data = await getData();

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl p-8">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <div className="mt-6 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-700">
          <i className="bi bi-exclamation-triangle-fill mr-1.5 text-amber-500"></i>{t.supabaseWarning} <code className="font-mono">next/.env.local</code>{" "}
          {t.supabaseWarningTail}
        </div>
      </main>
    );
  }

  const {
    name,
    coursesCount,
    avgScore,
    chaptersStudied,
    streak,
    grades,
    week,
    month,
    heat,
    courses,
    hasAttempts,
  } = data;

  const stats = [
    { label: t.stats.chapters, value: String(chaptersStudied), icon: <i className="bi bi-clock"></i>, accent: "text-brand-500" },
    { label: t.stats.courses, value: String(coursesCount), icon: <i className="bi bi-book"></i>, accent: "text-brand-500" },
    { label: t.stats.avgScore, value: hasAttempts ? avgScore.toFixed(1) : "—", icon: <i className="bi bi-star"></i>, accent: "text-brand-500" },
    { label: t.stats.streak, value: `${streak} ${t.stats.days}`, icon: <i className="bi bi-fire"></i>, accent: "text-brand-500" },
  ];

  const lowest = grades.length > 0 ? grades[grades.length - 1] : null;

  return (
    <main className="mx-auto max-w-6xl p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t.welcome}, {name}!
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {hasAttempts ? t.subtitleActive : t.subtitleNew}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 shadow-card">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-sm text-white">
            <i className="bi bi-lightning-charge-fill"></i>
          </span>
          <div className="text-xs">
            <p className="font-semibold text-slate-400">{t.currentStreak}</p>
            <p className="font-bold text-slate-800">
              {streak} {t.streakDays}
            </p>
          </div>
        </div>
      </div>

      {/* ── Quick Action Cards (Generate Course & Custom Quiz) ── */}
      <section className="mb-8 grid gap-6 md:grid-cols-2">
        <Link
          href="/dashboard/generate"
          className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm group relative flex flex-col transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-2xl text-brand-500">
            <i className={`bi ${t.quickActions.generateCourse.icon}`}></i>
          </span>

          <h2 className="mb-3 text-xl font-bold">{t.quickActions.generateCourse.title}</h2>
          <p className="mb-8 flex-1 leading-relaxed text-sm text-slate-500">
            {t.quickActions.generateCourse.desc}
          </p>

          <span className="flex items-center gap-2 text-sm font-semibold text-brand-500 transition-all group-hover:gap-3">
            {t.quickActions.generateCourse.cta}
            <i className="bi bi-arrow-right"></i>
          </span>
        </Link>

        <Link
          href="/dashboard/quizzes"
          className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm group relative flex flex-col transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-2xl text-brand-500">
            <i className={`bi ${t.quickActions.customQuiz.icon}`}></i>
          </span>

          <h2 className="mb-3 text-xl font-bold">{t.quickActions.customQuiz.title}</h2>
          <p className="mb-8 flex-1 leading-relaxed text-sm text-slate-500">
            {t.quickActions.customQuiz.desc}
          </p>

          <span className="flex items-center gap-2 text-sm font-semibold text-brand-500 transition-all group-hover:gap-3">
            {t.quickActions.customQuiz.cta}
            <i className="bi bi-arrow-right"></i>
          </span>
        </Link>
      </section>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <span className={`text-lg ${s.accent}`}>{s.icon}</span>
            <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-800">{s.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Learning Progress + Average Grades */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <ProgressChart week={week} month={month} />
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">{t.grades.title}</h2>
          <p className="text-xs text-slate-400">{t.grades.subtitle}</p>
          <div className="mt-5 space-y-4">
            {grades.length === 0 ? (
              <p className="text-sm text-slate-400">{t.grades.empty}</p>
            ) : (
              grades.map((g, i) => (
                <div key={g.title}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="line-clamp-1 font-medium text-slate-600">{g.title}</span>
                    <span className="font-bold text-slate-800">{g.avg}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-1.5 rounded-full ${GRADE_COLORS[i % GRADE_COLORS.length]}`}
                      style={{ width: `${g.avg}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {lowest && (
            <div className="mt-6 rounded-2xl bg-brand-50 p-4">
              <p className="text-xs font-semibold text-brand-700"> {t.grades.tipTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-brand-900/70">
                {t.grades.tipBefore} <span className="font-semibold">{lowest.title}</span> (
                {lowest.avg}%). {t.grades.tipAfter}
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Study Frequency + Achievement */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{t.frequency.title}</h2>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              {t.frequency.few}
              {["bg-brand-100", "bg-brand-300", "bg-brand-500", "bg-brand-700"].map((c) => (
                <span key={c} className={`h-2.5 w-2.5 rounded-sm ${c}`} />
              ))}
              {t.frequency.many}
            </div>
          </div>
          <p className="text-xs text-slate-400">{t.frequency.subtitle}</p>
          <div className="mt-5 grid grid-flow-col grid-rows-7 gap-1.5">
            {heat.map((d) => {
              const c =
                d.count === 0
                  ? "bg-slate-100"
                  : d.count === 1
                    ? "bg-brand-200"
                    : d.count === 2
                      ? "bg-brand-400"
                      : "bg-brand-600";
              return (
                <span
                  key={d.key}
                  title={`${d.key}: ${d.count} ${t.frequency.unit}`}
                  className={`h-4 w-4 rounded-sm ${c}`}
                />
              );
            })}
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-[#283157] p-6 text-white shadow-sm">
          <div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-light/10 text-lg">
              <i className="bi bi-diamond-fill"></i>
            </span>
            <h2 className="mt-3 text-lg font-bold">
              {avgScore >= 85 ? t.achievement.elite : t.achievement.rising}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              {hasAttempts
                ? avgScore >= 85
                  ? `${t.achievement.avgPrefix} ${avgScore.toFixed(1)} ${t.achievement.eliteBody}`
                  : `${t.achievement.avgPrefix} ${avgScore.toFixed(1)}. ${t.achievement.risingBody}`
                : t.achievement.emptyBody}
            </p>
          </div>
          <Link
            href="/dashboard/library"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#283157] transition hover:bg-slate-100"
          >
            {t.achievement.cta}
          </Link>
        </section>
      </div>

      {/* My Courses — akses cepat ke learning path tiap kursus */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.myCourses.title}</h2>
          <Link href="/dashboard/generate" className="text-xs font-medium text-brand-500 hover:underline">
            {t.myCourses.newCourse}
          </Link>
        </div>
        {courses.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl text-brand-500">
              <i className="bi bi-journal-bookmark-fill"></i>
            </div>
            <p className="mt-2 font-semibold text-slate-700">{t.myCourses.emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
              {t.myCourses.emptyBefore}{" "}
              <Link href="/dashboard/generate" className="font-semibold text-brand-500 hover:underline">
                {t.myCourses.generateLink}
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c: any, ci: number) => (
              <Link
                key={c.id}
                href={`/dashboard/courses/${c.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-slate-100"
              >
                <div
                  className={`relative flex h-24 items-start justify-between overflow-hidden p-3 ${
                    c.image_url ? "" : `bg-gradient-to-br ${HEADER_GRADIENTS[ci % HEADER_GRADIENTS.length]}`
                  }`}
                >
                  {c.image_url && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.image_url}
                        alt={c.title}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute inset-0 bg-ink-900/25" />
                    </>
                  )}
                  <span className="relative rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                    {c.total_chapters} bab
                  </span>
                  {c.completed && (
                    <span className="relative rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-bold text-white flex items-center gap-1">
                      <i className="bi bi-check-circle-fill text-[9px]"></i>
                      <span>Selesai</span>
                    </span>
                  )}
                  {!c.started && !c.completed && (
                    <span className="relative rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold text-ink-900">
                      NEW
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="line-clamp-1 font-bold text-slate-800 group-hover:text-brand-600 transition-colors">
                    {c.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 flex-1 text-xs text-slate-400 leading-relaxed">
                    {c.description ?? "Kurikulum hasil rancangan AI."}
                  </p>

                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-400">
                      <span>{c.completedChapters}/{c.totalChapters} bab selesai</span>
                      <span>{c.percent}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full bg-brand-500 transition-all duration-300"
                        style={{ width: `${c.percent}%` }}
                      />
                    </div>
                  </div>

                  <span className="mt-4 inline-block w-full rounded-xl bg-brand-500 py-2.5 text-center text-xs font-semibold text-white shadow-md shadow-brand-500/20 transition duration-200 group-hover:bg-brand-600">
                    {c.completed ? "Tinjau Ulang" : c.started ? "Lanjutkan" : "Mulai Belajar"}
                  </span>
                </div>
              </Link>
            ))}

            {/* Kartu Tambah Course Baru dengan AI */}
            <Link
              href="/dashboard/generate"
              className="group flex flex-col justify-between rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-white via-white to-indigo-50/40 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#283157]/30 hover:shadow-md"
            >
              <div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#283157]/5 border border-[#283157]/10 text-lg text-[#283157] transition-transform duration-300 group-hover:scale-105">
                  <i className="bi bi-stars"></i>
                </span>
                <h3 className="mt-3.5 text-sm font-extrabold text-[#283157] leading-snug">
                  Ingin Menambah Course Baru?
                </h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Berikan topik ke AI untuk menyusun course baru sesuai kebutuhanmu.
                </p>
              </div>
              <span className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#283157] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition duration-200 group-hover:bg-[#1f2644] active:scale-95">
                <i className="bi bi-plus-lg text-xs"></i>
                <span>Tambah dengan AI</span>
              </span>
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
