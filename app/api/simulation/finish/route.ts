import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { apiFetchSimulation, expressErrorMessage } from "@/lib/api";

// Fitur BB — tandai sesi selesai ('done') atau ditinggal ('abandoned').
// Satu route untuk keduanya (body.action); abandon juga dipanggil via
// navigator.sendBeacon saat tab ditutup, yang mengirim Blob JSON — request.json()
// tetap bisa membacanya.
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

  const body = await request.json().catch(() => ({}));
  const action = body.action === "abandon" ? "abandon" : "finish";

  try {
    const res = await apiFetchSimulation(`/api/simulation/${action}`, {
      method: "POST",
      body: JSON.stringify({ userId: user.id, sessionId: body.sessionId }),
    });
    const data = await res.json().catch(() => ({ error: "Respons tidak valid dari API service." }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: expressErrorMessage(err, "npm run dev:simulation") }, { status: 502 });
  }
}
