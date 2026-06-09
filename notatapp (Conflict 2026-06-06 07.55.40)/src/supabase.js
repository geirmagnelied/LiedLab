import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://hcdtagtkyewhrbrvrbqh.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZHRhZ3RreWV3aHJicnZyYnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODk0MDksImV4cCI6MjA5NjI2NTQwOX0.1Kg8MnI-ffWa5Ecc54BT_wP_mnftH9B1ZPIOoGaADfM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
