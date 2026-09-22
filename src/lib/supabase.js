import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Supabase belum dikonfigurasi. Salin .env.example menjadi .env lalu isi variabel VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY.");
}

export const supabase = createClient(url, key);
