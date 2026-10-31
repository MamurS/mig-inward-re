import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Field } from '@/components/Field'
import { DataTable, type Column } from '@/components/data/DataTable'
import { highlight } from '@/components/data/highlight'
import { EmptyState } from '@/components/EmptyState'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { cleanDecimal } from '@/lib/decimal'
import { ALL_ROLES } from '@/lib/roles'
import { formatAmount, formatBytes, formatDateTime, formatNumber } from '@/lib/format'
import type { Tables } from '@/lib/database.types'
import { textWords } from '@/features/search/query'
import { AI_USAGE_PAGE } from '@/features/search/pages'
import { useListSearch } from '@/features/search/useSearch'
import { SearchChips } from '@/features/search/SearchChips'

type UsageRow = Tables<'ai_usage_v'>
const STATUS_TONE: Record<string, BadgeTone> = { ok: 'success', cached: 'info', error: 'danger', refused: 'warning', limit: 'warning', disabled: 'neutral', too_big: 'warning' }

/**
 * Admin › AI: switch AI-assisted entry on or off, choose the roles that may
 * use it and the daily limit per user; the usage log (who, what, model,
 * tokens, outcome). The provider, model and key are Edge Function secrets —
 * never set here.
 */
export function AiAdminTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const settings = useQuery({
    queryKey: ['admin', 'ai-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('key, value').in('key', ['ai_enabled', 'ai_roles', 'ai_daily_limit'])
      if (error) throw error
      return Object.fromEntries((data ?? []).map((s) => [s.key, s.value])) as { ai_enabled?: boolean; ai_roles?: string[]; ai_daily_limit?: number }
    },
  })
  const [enabled, setEnabled] = useState(false)
  const [roles, setRoles] = useState<string[]>([])
  const [limit, setLimit] = useState('100')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!settings.data) return
    setEnabled(settings.data.ai_enabled === true)
    setRoles(settings.data.ai_roles ?? [])
    setLimit(String(settings.data.ai_daily_limit ?? 100))
  }, [settings.data])

  const { parsed, filter, setQ } = useListSearch(AI_USAGE_PAGE)
  const usage = useQuery({
    queryKey: ['admin', 'ai-usage', filter],
    enabled: parsed !== null,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase.from('ai_usage_v').select('*', { count: 'exact' })
      if (filter) q = q.or(filter)
      const { data, error, count } = await q.order('created_at', { ascending: false }).limit(500)
      if (error) throw error
      return { rows: (data ?? []) as UsageRow[], count: count ?? 0 }
    },
  })
  const rows = usage.data?.rows ?? []
  const tokensIn = rows.reduce((s, r) => s + (r.input_tokens ?? 0), 0)
  const tokensOut = rows.reduce((s, r) => s + (r.output_tokens ?? 0), 0)

  async function save() {
    const digits = cleanDecimal(limit, 'int')
    const n = Number(digits)
    if (!/^\d{1,5}$/.test(digits) || n < 1) return toast.error(t('ai.admin.badLimit'))
    setBusy(true)
    try {
      const { error } = await supabase.from('settings').upsert([
        { key: 'ai_enabled', value: enabled },
        { key: 'ai_roles', value: roles },
        { key: 'ai_daily_limit', value: n },
      ])
      if (error) throw error
      toast.success(t('admin.saved'))
      await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'ai-settings'] }), qc.invalidateQueries({ queryKey: ['ai'] })])
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<UsageRow>[] = [
    { id: 'when', header: t('ai.when'), cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.created_at)}</span> },
    { id: 'user', header: t('ai.user'), cell: (r, c) => c.hl(r.user_name) },
    { id: 'kind', header: t('ai.kindLabel'), cell: (r) => t(`ai.kind.${r.kind}`) },
    { id: 'status', header: t('fields.status'), cell: (r) => <Badge tone={STATUS_TONE[r.status ?? ''] ?? 'neutral'}>{t(`ai.status.${r.status}`)}</Badge> },
    { id: 'file', header: t('ai.file'), className: 'max-w-64', cell: (r, c) => <span className="block truncate" title={r.file_name ?? ''}>{c.hl(r.file_name) || '—'}{r.file_bytes ? <span className="text-caption text-muted-foreground"> · {formatBytes(r.file_bytes)}</span> : null}</span> },
    { id: 'model', header: t('ai.model'), defaultHidden: true, cell: (r) => r.model ?? '—' },
    { id: 'in', header: t('ai.inputTokens'), align: 'right', cell: (r) => (r.input_tokens === null ? '—' : formatAmount(r.input_tokens).replace(/[.,]00$/, '')) },
    { id: 'out', header: t('ai.outputTokens'), align: 'right', cell: (r) => (r.output_tokens === null ? '—' : formatAmount(r.output_tokens).replace(/[.,]00$/, '')) },
    { id: 'ms', header: t('ai.duration'), align: 'right', defaultHidden: true, cell: (r) => (r.duration_ms === null ? '—' : `${formatNumber(r.duration_ms / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`) },
    { id: 'error', header: t('ai.error'), defaultHidden: true, className: 'max-w-64', cell: (r) => <span className="block truncate" title={r.error ?? ''}>{r.error ?? '—'}</span> },
  ]

  return (
    <div className="grid gap-4" data-ai-admin>
      <Card>
        <CardHeader>
          <CardTitle>{t('ai.admin.title')}</CardTitle>
          <p className="text-caption text-muted-foreground">{t('ai.admin.help')}</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="flex items-center gap-2 text-body">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} data-ai-enabled />
            {t('ai.admin.enabled')}
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-small font-medium">{t('ai.admin.roles')}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {ALL_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-body">
                  <input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))} />
                  {t(`roles.${r}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={t('ai.admin.limit')} hint={t('ai.admin.limitHint')}>
            <DecimalInput kind="int" className="w-32 text-right tabular-nums" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </Field>
          <div>
            <Button onClick={() => void save()} disabled={busy || settings.isLoading}>
              {busy ? <Loader2 className="animate-spin" /> : <Save />}
              {t('common.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {parsed && (
        <SearchChips
          query={parsed}
          scope={AI_USAGE_PAGE.scope}
          onChange={setQ}
          count={<span>{t('ai.admin.count', { count: usage.data?.count ?? 0 })} · {t('ai.admin.tokens', { input: formatAmount(tokensIn).replace(/[.,]00$/, ''), output: formatAmount(tokensOut).replace(/[.,]00$/, '') })}</span>}
        />
      )}
      <Card className="gap-0 py-0">
        <DataTable
          id="ai-usage"
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id!}
          loading={usage.isLoading}
          hl={(text) => highlight(text, parsed ? textWords(parsed) : [])}
          empty={<EmptyState pictogram="inbox" title={t('ai.admin.noUsage')} />}
        />
      </Card>
    </div>
  )
}
