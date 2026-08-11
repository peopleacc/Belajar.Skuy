import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client dengan service_role key — menembus RLS.
 *
 * HANYA dipakai di server-side API routes (Payment Webhook, dsb.) yang
 * perlu menulis tabel yang dikunci untuk user biasa (misal: `subscriptions`,
 * `orders`). TIDAK PERNAH diekspos ke browser (bukan NEXT_PUBLIC_*).
 *
 * Menggunakan lazy initialization agar tidak error saat `next build` jika
 * SUPABASE_SERVICE_ROLE_KEY belum terisi.
 */
let adminInstance: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminInstance) return adminInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY atau NEXT_PUBLIC_SUPABASE_URL belum dikonfigurasi di environment variable."
    );
  }

  adminInstance = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminInstance;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const val = (client as any)[prop];
    if (typeof val === "function") {
      return val.bind(client);
    }
    return val;
  },
});

