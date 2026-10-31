import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BookCopy, CalendarX, Clock, Gauge } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { BINDERS_PAGE, pageLink } from '@/features/search/pages'
import { useAllBinders } from './api'
import { CapacityBar } from './BinderBadges'
import { ATTENTION_MAX, AttentionCard, RefLines, RefRow } from '@/features/dashboard/Attention'

const bl = (q: string) => pageLink(BINDERS_PAGE, q)

/**
 * Dashboard › Binders: active binders, bordereaux missing or late, binders at
 * 80 % of their aggregate or more — each opens the filtered register; the
 * list names the binders near their limit. The bordereaux to chase are in
 * «Needs attention» ({@link BordereauxToChase}).
 */
export function BindersDashboard() {
  const { t } = useTranslation()
  const binders = useAllBinders()

  if (binders.isLoading) return <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
  if (binders.error) return <p className="mb-4 text-body text-destructive">{errorMessage(binders.error)}</p>

  const rows = binders.data ?? []
  const active = rows.filter((b) => b.status === 'active')
  const missing = rows.filter((b) => (b.missing_count ?? 0) > 0).sort((a, b) => (b.missing_count ?? 0) - (a.missing_count ?? 0))
  const late = rows.filter((b) => (b.late_count ?? 0) > 0)
  const full = rows.filter((b) => (b.capacity_pct ?? 0) >= 80).sort((a, b) => (b.capacity_pct ?? 0) - (a.capacity_pct ?? 0))
  const missingTotal = missing.reduce((s, b) => s + (b.missing_count ?? 0), 0)
  const lateTotal = late.reduce((s, b) => s + (b.late_count ?? 0), 0)

  return (
    <section aria-labelledby="dash-binders" className="mb-4 grid gap-4" data-binders-dashboard>
      <h2 id="dash-binders" className="text-title font-semibold">{t('binder.dashTitle')}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={BookCopy} label={t('binder.activeBinders')} value={active.length} to={bl('status:active')} />
        <KpiCard icon={CalendarX} label={t('binder.missingBordereaux')} value={missingTotal} sub={t('binder.onBinders', { count: missing.length })} to={bl('missing')} alert={missingTotal > 0} />
        <KpiCard icon={Clock} label={t('binder.lateBordereaux')} value={lateTotal} sub={t('binder.onBinders', { count: late.length })} to={bl('late')} />
        <KpiCard icon={Gauge} label={t('binder.capacityAlerts')} value={full.length} sub={t('binder.atLeast80')} to={bl('capacity>=80')} alert={full.some((b) => (b.capacity_pct ?? 0) >= 100)} />
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 py-4">
          <CardTitle>{t('binder.capacityAlerts')}</CardTitle>
          <Link to={bl('capacity>=80')} className="text-body text-link hover:underline">{t('dash.openInRegister')}</Link>
        </CardHeader>
        {full.length === 0 ? (
          <EmptyState pictogram="done" title={t('binder.noCapacityAlerts')} compact />
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)_auto] border-t [&>li:last-child>a]:border-b-0" data-ref-list data-capacity-alerts>
            {full.slice(0, 8).map((b) => (
              <RefRow key={b.id} to={`/binders/${b.id}`}>
                <RefLines name={b.mga_name} refNo={b.binder_ref} sub={`${b.currency} · ${t('binder.expiresOn', { date: formatDate(b.period_to) })}`} />
                <CapacityBar pct={b.capacity_pct} />
              </RefRow>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}

/** «Needs attention»: binders with bordereaux missing or late, the most missing first. */
export function BordereauxToChase() {
  const { t } = useTranslation()
  const binders = useAllBinders()
  const rows = binders.data ?? []
  const missing = rows.filter((b) => (b.missing_count ?? 0) > 0).sort((a, b) => (b.missing_count ?? 0) - (a.missing_count ?? 0))
  const late = rows.filter((b) => (b.late_count ?? 0) > 0)
  const chase = [...new Map([...missing, ...late].map((b) => [b.id, b])).values()]
  return (
    <AttentionCard title={t('binder.toChase')} count={chase.length} to={bl('missing')} empty={t('binder.allIn')} loading={binders.isLoading} error={binders.error} data="bordereaux-to-chase">
      {chase.slice(0, ATTENTION_MAX).map((b) => (
        <RefRow key={b.id} to={`/binders/${b.id}`}>
          <RefLines name={b.mga_name} refNo={b.binder_ref} sub={b.last_received ? t('binder.lastReceivedOn', { date: formatDate(b.last_received) }) : t('binder.nothingReceived')} />
          <span className="inline-flex flex-wrap justify-end gap-1">
            {(b.missing_count ?? 0) > 0 && <Badge tone="danger">{t('binder.missingN', { count: b.missing_count ?? 0 })}</Badge>}
            {(b.late_count ?? 0) > 0 && <Badge tone="warning">{t('binder.lateN', { count: b.late_count ?? 0 })}</Badge>}
          </span>
        </RefRow>
      ))}
    </AttentionCard>
  )
}
