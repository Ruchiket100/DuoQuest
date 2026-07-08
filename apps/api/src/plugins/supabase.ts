import fp from "fastify-plugin";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}

export default fp(async (app: FastifyInstance) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    app.log.warn(
      "⚠️  Supabase credentials not found — Realtime and Storage features will be unavailable"
    );

    // Decorate with a null-safe placeholder
    app.decorate("supabase", null as unknown as SupabaseClient);
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  app.decorate("supabase", supabase);
  app.log.info("☁️  Supabase client initialized");
});
