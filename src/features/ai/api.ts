import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AiSubmission } from './apply'
import { findDuplicates, keyWord, type Duplicate, type Existing } from './match'

export const MAX_AI_FILE_BYTES = 8 * 1024 * 1024
export const AI_FILE_TYPES = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.eml,application/pdf,image/*,text/plain'

/** May this user use AI-assisted entry now (switched on, role allowed)? */
export function useAiAvailable() {
  return useQuery({
    queryKey: ['ai', 'available'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ai_available')
      if (error) return false
      return Boolean(data)
    },
  })
}

export class AiError extends Error {
  constructor(message: string, public code: string) {
    super(message)
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-extract', { body })
  if (error) {
    // the function's own message and code when there is one
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json().catch(() => null)
      if (j?.error) throw new AiError(j.error, j.code ?? 'error')
    }
    throw new AiError(error.message, 'error')
  }
  return data as T
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

const MIME_BY_EXT: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', txt: 'text/plain', eml: 'message/rfc822' }

/** Read a submission document (or pasted text) into suggested fields. */
export async function extractSubmission(input: { file: File } | { text: string }): Promise<AiSubmission> {
  if ('text' in input) return invoke<AiSubmission>({ kind: 'submission', text: input.text })
  const f = input.file
  if (f.size > MAX_AI_FILE_BYTES) throw new AiError('too-big', 'too_big')
  const mime = f.type || MIME_BY_EXT[f.name.split('.').pop()?.toLowerCase() ?? ''] || 'application/octet-stream'
  return invoke<AiSubmission>({ kind: 'submission', file: { name: f.name, mime, base64: await toBase64(f) } })
}

export type AiMapping = { mapping: { field: string; column: string | null; confidence: number; reason: string | null }[]; header_row: number | null; cached?: boolean }

/** Suggest a bordereau's column mapping from its titles and a few sample rows (the file itself is not sent). */
export function suggestMapping(input: { bordereauKind: string; targets: { key: string; label: string; required: boolean }[]; columns: string[]; samples: string[][]; headerRow: number }) {
  return invoke<AiMapping>({ kind: 'bordereau_mapping', bordereau_kind: input.bordereauKind, targets: input.targets, columns: input.columns, samples: input.samples, header_row: input.headerRow })
}

/** Submissions already in the register that look like this one. */
export function useDuplicates(c: { insured_name: string | null; mga_id: string | null; period_from: string | null } | null) {
  const word = c?.insured_name ? keyWord(c.insured_name) : null
  return useQuery({
    queryKey: ['ai', 'duplicates', word, c?.mga_id, c?.period_from],
    enabled: Boolean(word),
    queryFn: async (): Promise<Duplicate[]> => {
      const { data, error } = await supabase
        .from('submissions_v')
        .select('id, ref_no, insured_name, mga_id, period_from, status')
        .ilike('insured_name', `%${word!.replace(/[%_\\]/g, '')}%`)
        .limit(50)
      if (error) throw error
      return findDuplicates(c!, (data ?? []) as Existing[])
    },
  })
}
