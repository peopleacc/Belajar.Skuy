import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetchSimulationForm, expressErrorMessage } from "@/lib/api";

const MAX_BYTES = 10 * 1024 * 1024;

// Fitur BB — kirim segmen slide (audio opsional) untuk ditranskrip & disimpan.
// Audio hanya LEWAT di sini (tidak disimpan) — pola yang sama dengan transcribe.
export async function POST(request: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });
  }

  const incoming = await request.formData().catch(() => null);
  if (!incoming) {
    return NextResponse.json({ error: "Form data tidak valid." }, { status: 400 });
  }

  const audio = incoming.get("audio");
  if (audio instanceof File && audio.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Rekaman slide ini terlalu besar (maksimal 10MB)." },
      { status: 413 }
    );
  }

  const outgoing = new FormData();
  outgoing.append("userId", user.id);
  outgoing.append("sessionId", String(incoming.get("sessionId") ?? ""));
  outgoing.append("index", String(incoming.get("index") ?? ""));
  outgoing.append("durationMs", String(incoming.get("durationMs") ?? "0"));
  if (audio instanceof File && audio.size > 0) {
    outgoing.append("audio", audio, "segmen.webm");
  }
  // BUG lama: field ini sempat tidak diteruskan sama sekali ke Express (silently
  // dropped) meski sudah dikirim client & sudah bisa diterima server — diperbaiki
  // sekalian saat menambahkan slideImage (Fitur DB) di baris yang sama.
  const visualMetrics = incoming.get("visualMetrics");
  if (typeof visualMetrics === "string" && visualMetrics) {
    outgoing.append("visualMetrics", visualMetrics);
  }
  // Fitur DB — base64 gambar halaman PDF slide ini (opsional, cuma presentasi).
  const slideImage = incoming.get("slideImage");
  if (typeof slideImage === "string" && slideImage) {
    outgoing.append("slideImage", slideImage);
  }

  try {
    const res = await apiFetchSimulationForm("/api/simulation/segment", outgoing);
    const data = await res.json().catch(() => ({ error: "Respons tidak valid dari API service." }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: expressErrorMessage(err, "npm run dev:simulation") }, { status: 502 });
  }
}
