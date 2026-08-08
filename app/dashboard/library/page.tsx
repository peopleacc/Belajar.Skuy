import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

// Fitur C — Study Library: bab yang SUDAH digenerate, dikelompokkan per materi/modul.
// Bab masih "pending" (baru judul dari silabus) sengaja disembunyikan di sini
// (beda dengan learning path course yang tetap menampilkannya sebagai node terkunci).

type ChapterRow = {
  id: string;
  chapter_number: number;
  title: string;
  body: { status?: string } | null;
  image_url: string | null;
};

type ModuleRow = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  contents: ChapterRow[];
};

function isGenerated(body: ChapterRow["body"]) {
  return body != null && body.status !== "pending";
}

export default async function LibraryPage() {
  const configured = supabaseConfigured;
  let modules: ModuleRow[] = [];

  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("modules")
      .select("id,title,description,created_at,contents(id,chapter_number,title,body,image_url)")
      .gt("total_chapters", 0)
      .order("created_at", { ascending: false });
    modules = (data ?? []) as ModuleRow[];
  }

  // Sisakan hanya bab generated; buang modul yang belum punya bab generated sama sekali
  const groups = modules
    .map((m) => ({
      ...m,
      chapters: (m.contents ?? [])
        .filter((c) => isGenerated(c.body))
        .sort((a, b) => a.chapter_number - b.chapter_number),
    }))
    .filter((m) => m.chapters.length > 0);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-bold tracking-tight">Study Library</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Semua bab yang sudah selesai digenerate, dikelompokkan per materi. Klik bab mana pun
        untuk membuka kembali ruang belajarnya.
      </p>

      {!configured && (
        <div className="mt-6 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-700">
          ⚠ Supabase belum dikonfigurasi. Isi <code className="font-mono">next/.env.local</code>{" "}
          agar Study Library menampilkan data asli.
        </div>
      )}

      {configured && groups.length === 0 ? (
        <div className="mt-8 rounded-sm border-2 border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-xl">
            📖
          </div>
          <p className="font-semibold text-slate-700">Belum ada bab yang digenerate</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
            Buat materi baru dan generate babnya dari{" "}
            <Link href="/dashboard" className="font-semibold text-brand-500 hover:underline">
              Dashboard
            </Link>
            . Bab yang sudah jadi akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((m) => (
            <section key={m.id}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{m.title}</h2>
                  {m.description && (
                    <p className="line-clamp-1 text-xs text-slate-400">{m.description}</p>
                  )}
                </div>
                <Link
                  href={`/dashboard/courses/${m.id}`}
                  className="shrink-0 text-xs font-medium text-brand-500 hover:underline"
                >
                  Lihat learning path →
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {m.chapters.map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/dashboard/learn/${ch.id}`}
                    className="group overflow-hidden rounded-sm bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    {ch.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ch.image_url}
                        alt={ch.title}
                        className="h-24 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center bg-gradient-to-br from-brand-500 to-brand-800 text-2xl">
                        📘
                      </div>
                    )}
                    <div className="p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-brand-500">
                        Bab {ch.chapter_number}
                      </span>
                      <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug">
                        {ch.title}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
