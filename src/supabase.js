import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel (Preview/Production).'
  )
}

// When env vars are missing (e.g. during prerender), return a no-op client
// so supabase.from(...).select(...) etc. resolve with empty data instead of crashing.
// Every method returns another chainable that is also a thenable resolving to { data: null, error: null, count: null }.
const NOOP_RESULT = { data: null, error: null, count: null }

function createNoopChain() {
  const handler = {
    get(_, prop) {
      if (prop === 'then') return (fn) => Promise.resolve(NOOP_RESULT).then(fn)
      if (prop === 'catch') return (fn) => Promise.resolve(NOOP_RESULT).catch(fn)
      return () => new Proxy({}, handler)
    }
  }
  return new Proxy({}, handler)
}

const noopClient = {
  from: () => createNoopChain(),
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: () => Promise.resolve({ error: null }),
    signOut: () => Promise.resolve(),
  }
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : noopClient
