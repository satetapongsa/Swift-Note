import { createClient } from '@supabase/supabase-js'

// REPLACE WITH YOUR SUPABASE PROJECT DETAILS
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
