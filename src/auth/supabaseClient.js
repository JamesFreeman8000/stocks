// src/auth/supabaseClient.js
// One shared Supabase client for the whole app.
// Fill these from your Supabase project: Settings -> API.
// They are PUBLIC values (safe in frontend) — the anon key is meant to be
// exposed; Row-Level Security is what protects your data.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabaseEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = supabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
