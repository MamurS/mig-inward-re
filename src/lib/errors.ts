import i18n from '@/i18n'

/** Human-readable message from a Supabase / JS error. */
export function errorMessage(e: unknown): string {
  const msg =
    typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : String(e ?? '')
  if (/confirmation evidence/i.test(msg)) return i18n.t('errors.evidenceDoc')
  if (/permission denied|row-level security/i.test(msg)) return i18n.t('errors.permission')
  if (/Failed to fetch|NetworkError/i.test(msg)) return i18n.t('errors.network')
  return msg || i18n.t('errors.unknown')
}
