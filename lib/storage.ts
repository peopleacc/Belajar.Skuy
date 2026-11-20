import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabase/admin";

/**
 * Modul Utilitas Penyimpanan Berkas Dokumen Kursus (Task 16B-MS)
 *
 * Mengelola interaksi dengan bucket privat Supabase Storage "course-documents":
 * 1. Upload berkas PDF fisik terisolasi per folder pengguna ({userId}/{moduleId}.pdf).
 * 2. Penerbitan Signed URL berbatas waktu (default 60 menit) untuk rendering aman di peramban.
 * 3. Pembersihan berkas saat modul kursus dihapus.
 * 4. Kepatuhan Aturan F: Strict Vector Iconography (Zero Keyboard Emoji).
 */

export const COURSE_DOCUMENTS_BUCKET = "course-documents";
export const DEFAULT_SIGNED_URL_EXPIRES_IN = 3600; // 60 menit dalam detik

/**
 * Membentuk path penyimpanan terstandarisasi untuk dokumen PDF kursus
 * @param userId - ID pengguna pemilik kursus
 * @param moduleId - ID modul kursus
 * @returns Path relatif di dalam bucket: {userId}/{moduleId}.pdf
 */
export function buildDocumentStoragePath(userId: string, moduleId: string): string {
  const cleanUser = String(userId || "").trim();
  const cleanModule = String(moduleId || "").trim();

  if (!cleanUser || !cleanModule) {
    throw new Error("userId dan moduleId wajib disertakan untuk membentuk storage path.");
  }

  return `${cleanUser}/${cleanModule}.pdf`;
}

/**
 * Memverifikasi apakah suatu path berkas dokumen berada di dalam folder user yang bersangkutan
 * @param filePath - Path berkas di dalam bucket storage
 * @param userId - ID pengguna yang memverifikasi kepemilikan
 */
export function verifyDocumentOwnership(filePath: string, userId: string): boolean {
  if (!filePath || !userId) return false;
  const parts = filePath.split("/");
  return parts.length >= 2 && parts[0] === userId.trim();
}

/**
 * Mengunggah berkas PDF dokumen kursus ke bucket privat
 * @param params - Parameter upload { userId, moduleId, fileBody, contentType, client }
 */
export async function uploadCourseDocument(params: {
  userId: string;
  moduleId: string;
  fileBody: Buffer | Uint8Array | Blob | ArrayBuffer;
  contentType?: string;
  client?: SupabaseClient;
}): Promise<{ path: string | null; error: string | null }> {
  try {
    const { userId, moduleId, fileBody, contentType = "application/pdf" } = params;
    const storagePath = buildDocumentStoragePath(userId, moduleId);
    const client = params.client || getSupabaseAdmin();

    const { error: uploadError } = await client.storage
      .from(COURSE_DOCUMENTS_BUCKET)
      .upload(storagePath, fileBody, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[storage] Gagal mengunggah berkas dokumen kursus:", uploadError.message);
      return { path: null, error: uploadError.message };
    }

    return { path: storagePath, error: null };
  } catch (err: any) {
    console.error("[storage] Exception pada uploadCourseDocument:", err?.message || err);
    return { path: null, error: err?.message || "Gagal mengunggah dokumen kursus." };
  }
}

/**
 * Menerbitkan Signed URL sementara untuk penampil dokumen PDF di sisi klien
 * @param filePath - Path berkas dokumen di dalam bucket
 * @param expiresInSec - Masa berlaku token dalam detik (default 3.600 detik / 60 menit)
 * @param client - Supabase client opsional
 */
export async function getCourseDocumentSignedUrl(
  filePath: string,
  expiresInSec: number = DEFAULT_SIGNED_URL_EXPIRES_IN,
  client?: SupabaseClient
): Promise<{ signedUrl: string | null; error: string | null }> {
  try {
    if (!filePath || typeof filePath !== "string") {
      return { signedUrl: null, error: "filePath tidak valid." };
    }

    const sbClient = client || getSupabaseAdmin();
    const { data, error } = await sbClient.storage
      .from(COURSE_DOCUMENTS_BUCKET)
      .createSignedUrl(filePath.trim(), expiresInSec);

    if (error || !data?.signedUrl) {
      console.error("[storage] Gagal membuat signed URL dokumen:", error?.message);
      return { signedUrl: null, error: error?.message || "Gagal membuat URL akses dokumen." };
    }

    return { signedUrl: data.signedUrl, error: null };
  } catch (err: any) {
    console.error("[storage] Exception pada getCourseDocumentSignedUrl:", err?.message || err);
    return { signedUrl: null, error: err?.message || "Gagal membuat URL akses dokumen." };
  }
}

/**
 * Menghapus berkas fisik dokumen kursus dari storage
 * @param filePath - Path berkas dokumen di dalam bucket
 * @param client - Supabase client opsional
 */
export async function deleteCourseDocument(
  filePath: string,
  client?: SupabaseClient
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (!filePath || typeof filePath !== "string") {
      return { success: false, error: "filePath tidak valid." };
    }

    const sbClient = client || getSupabaseAdmin();
    const { error } = await sbClient.storage
      .from(COURSE_DOCUMENTS_BUCKET)
      .remove([filePath.trim()]);

    if (error) {
      console.error("[storage] Gagal menghapus berkas dokumen kursus:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error("[storage] Exception pada deleteCourseDocument:", err?.message || err);
    return { success: false, error: err?.message || "Gagal menghapus berkas dokumen." };
  }
}
