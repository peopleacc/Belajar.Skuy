import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client dengan service_role key — menembus RLS.
 *
 * HANYA dipakai di server-side API routes (Payment Webhook, dsb.) yang
 * perlu menulis tabel yang dikunci untuk user biasa (misal: `subscriptions`,
 * `orders`). TIDAK PERNAH diekspos ke browser (bukan NEXT_PUBLIC_*).
 *
 * Referensi keamanan: migration 006_plans_subscriptions.sql — policy RLS
 * pada `subscriptions` sengaja TIDAK ada insert/update untuk `authenticated`,
 * jadi hanya service_role yang bisa mengubah status langganan user.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      // Service role tidak butuh persistensi sesi
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
