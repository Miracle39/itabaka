import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase belum dikonfigurasi. Salin .env.example menjadi .env lalu isi URL dan publishable key.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
