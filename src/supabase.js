import { createClient } from '@supabase/supabase-js'

// 🔒 TEMPORARY: force STAGING
const supabaseUrl = 'https://ytydzupuelcaacovhqps.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eWR6dXB1ZWxjYWFjb3ZocXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0ODA3NDgsImV4cCI6MjA4NTA1Njc0OH0.FYQ_sB_bNSmX50KQLhg7Xkxaclbvm4D5ty9TKs2-YL4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
