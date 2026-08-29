import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && key)

if (!isSupabaseConfigured) {
  console.error('[sneham] Built without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — auth and data will not work.')
}

export const supabase = createClient(
  url ?? 'https://unconfigured.supabase.co',
  key ?? 'unconfigured',
)
