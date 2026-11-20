import { NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { getCourseDocumentSignedUrl, verifyDocumentOwnership } from "@/lib/storage";

export const maxDuration = 30;

/**
 * POST /api/courses/document-url
 * Menerbitkan signed URL sementara (berlaku 60 menit) untuk menampilkan berkas PDF
 * kursus privat milik pengguna di penampil PDF split-pane.
 */
export async function POST(request: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase belum dikonfigurasi (next/.env.local)." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const filePath = typeof body.filePath === "string" ? body.filePath.trim() : "";

  if (!filePath) {
    return NextResponse.json({ error: "filePath wajib disertakan." }, { status: 400 });
  }

  // Verifikasi isolasi kepemilikan dokumen pengguna (Row Level Authorization)
  if (!verifyDocumentOwnership(filePath, user.id)) {
    return NextResponse.json(
      { error: "Akses ditolak: Anda tidak memiliki akses ke berkas dokumen ini." },
      { status: 403 }
    );
  }

  const { signedUrl, error } = await getCourseDocumentSignedUrl(filePath, 3600);
  if (error || !signedUrl) {
    return NextResponse.json(
      { error: error || "Gagal menerbitkan signed URL dokumen." },
      { status: 500 }
    );
  }

  return NextResponse.json({ signedUrl });
}
