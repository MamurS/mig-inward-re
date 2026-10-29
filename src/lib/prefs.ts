import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'

/**
 * A small per-user, per-browser preference (table density, hidden columns).
 * Kept in localStorage under the signed-in user's id, so two people sharing a
 * computer keep their own settings. Purely visual — never business data.
 */
export function usePref<T>(name: string, fallback: T): [T, (value: T) => void] {
  const { profile } = useAuth()
  const key = `mig.pref.${profile?.id ?? 'anon'}.${name}`
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
