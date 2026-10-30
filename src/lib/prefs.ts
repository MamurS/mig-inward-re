import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'

/**
 * A small per-user, per-browser preference (hidden table columns).
 * Kept in localStorage under the signed-in user's id, so two people sharing a
 * computer keep their own settings. Purely visual — never business data.
 */
export function usePref<T>(name: string, fallback: T): [T, (value: T) => void] {
  // The session's user id is there before any data renders (the profile row comes later),
  // so the saved value applies on the first paint — no jump from the default.
  const { session } = useAuth()
  const key = `mig.pref.${session?.user.id ?? 'anon'}.${name}`
  const read = useCallback((): T => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const [value, setValue] = useState<T>(read)
  useEffect(() => setValue(read()), [read])
  const set = useCallback(
    (v: T) => {
      setValue(v)
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        /* storage unavailable: keep it for this session only */
      }
    },
    [key],
  )
  return [value, set]
}
