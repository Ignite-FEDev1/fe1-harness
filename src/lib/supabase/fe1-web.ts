import { createClient } from '@supabase/supabase-js';

export function createFe1WebClient() {
  return createClient(
    process.env.FE1_WEB_SUPABASE_URL!,
    process.env.FE1_WEB_SUPABASE_SERVICE_KEY!,
  );
}
