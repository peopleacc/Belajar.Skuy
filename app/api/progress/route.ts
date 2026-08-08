import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

// Fitur E — catat progres materi bertahap per bab (section demi section).
// CRUD ringan langsung ke Supabase dari Next.js (RLS menegakkan kepemilikan),
// tidak lewat Express. current_step tidak pernah turun (ambil yang terbesar).
export async function POST(request: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const contentId = typeof body.contentId === "string" ? body.contentId : "";
  const step = Number(body.step);
  const totalSteps = Number(body.totalSteps);

  if (!contentId || !Number.isFinite(step) || !Number.isFinite(totalSteps) || totalSteps < 1) {
    return NextResponse.json({ error: "Parameter progres tidak valid." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });
  }

  const clampedStep = Math.max(0, Math.min(step, totalSteps));

  // Ambil progres lama supaya current_step tidak turun (mis. user mundur lalu maju lagi)
  const { data: existing } = await supabase
    .from("content_progress")
    .select("current_step, completed_at")
    .eq("user_id", user.id)
    .eq("content_id", contentId)
    .maybeSingle();

  const nextStep = Math.max(existing?.current_step ?? 0, clampedStep);

  // Fitur K — tandai bab SELESAI saat langkah mencapai total (ujian lulus) → buka bab berikutnya.
  const completedAt =
    (existing as { completed_at?: string | null } | null)?.completed_at ??
    (nextStep >= totalSteps ? new Date().toISOString() : null);

  const { error } = await supabase
    .from("content_progress")
    .upsert(
      {
        user_id: user.id,
        content_id: contentId,
        current_step: nextStep,
        total_steps: totalSteps,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,content_id" }
    );

  if (error) {
    return NextResponse.json({ error: "Gagal menyimpan progres." }, { status: 500 });
  }

  return NextResponse.json({ current_step: nextStep, total_steps: totalSteps });
}
