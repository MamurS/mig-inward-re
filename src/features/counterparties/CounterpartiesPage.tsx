import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { formatAmount } from '@/lib/format'
import { useCounterparties, useCountries, useLocalName } from '@/hooks/useReference'
import type { Enums } from '@/lib/database.types'
import { QuickAddCounterparty } from './QuickAddCounterparty'

type Stat = { mga_id: string; broker_id: string | null; status: string; our_gross_premium_usd: number | null }

export function CounterpartiesPage() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const navigate = useNavigate()
  const counterparties = useCounterparties()
  const countries = useCountries()
  const localName = useLocalName()
  const [q, setQ] = useState('')
  const [type, setType] = useState<'' | Enums<'counterparty_type'>>('')
  const [showInactive, setShowInactive] = useState(false)

  const stats = useQuery({
    queryKey: ['submissions', 'cp-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('submissions_v').select('mga_id, broker_id, status, our_gross_premium_usd').limit(10000)
      if (error) throw error
      return data as Stat[]
    },
  })

  const perParty = useMemo(() => {
    const map = new Map<string, { count: number; bound: number; boundUsd: number }>()
    const add = (id: string | null, r: Stat) => {
      if (!id) return
      const e = map.get(id) ?? { count: 0, bound: 0, boundUsd: 0 }
      e.count++
      if (r.status === 'bound') {
        e.bound++
        e.boundUsd += r.our_gross_premium_usd ?? 0
      }
      map.set(id, e)
    }
    for (const r of stats.data ?? []) {
      add(r.mga_id, r)
      add(r.broker_id, r)
    }
    return map
  }, [stats.data])

  const rows = (counterparties.data ?? []).filter(
    (c) => (showInactive || c.active) && (!type || c.type === type) && (!q || c.name.toLowerCase().includes(q.toLowerCase())),
  )

  return (
    <>
      <PageHeader
        title={t('pages.counterparties.title')}
        subtitle={t('pages.counterparties.subtitle')}
        actions={
          can.editSubmissions(role) && (
            <div className="flex gap-2">
              {(['mga', 'broker', 'cedent'] as const).map((tp) => (
                <div key={tp} className="flex items-center gap-2 text-body">
                  <QuickAddCounterparty type={tp} onCreated={(id) => navigate(`/counterparties/${id}`)} />
                  <span className="hidden text-muted-foreground lg:inline">{t(`counterpartyType.${tp}`)}</span>
                </div>
              ))}
            </div>
          )
        }
      />
      <Card className="mb-4 flex-row flex-wrap items-center gap-3 px-4 py-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('cp.search')} className="pl-8" />
        </div>
        <div className="w-44">
          <NativeSelect value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="">{t('cp.allTypes')}</option>
            {(['mga', 'broker', 'cedent'] as const).map((tp) => <option key={tp} value={tp}>{t(`counterpartyType.${tp}`)}</option>)}
          </NativeSelect>
        </div>
        <label className="flex items-center gap-2 text-body">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          {t('cp.showInactive')}
        </label>
      </Card>
      <Card className="gap-0 py-0">
        {counterparties.isLoading ? (
          <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('fields.name')}</TableHead>
                <TableHead>{t('cp.type')}</TableHead>
                <TableHead>{t('fields.country')}</TableHead>
                <TableHead className="text-right">{t('cp.submissions')}</TableHead>
                <TableHead className="text-right">{t('cp.bound')}</TableHead>
                <TableHead className="text-right">{t('cp.boundUsd')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const s = perParty.get(c.id)
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/counterparties/${c.id}`)}>
                    <TableCell className="font-medium">
                      <Link to={`/counterparties/${c.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{c.name}</Link>
                      {!c.active && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-caption text-muted-foreground">{t('common.inactive')}</span>}
                    </TableCell>
                    <TableCell>{t(`counterpartyType.${c.type}`)}</TableCell>
                    <TableCell>{localName(countries.data?.find((x) => x.code === c.country_code)) }</TableCell>
                    <TableCell className="text-right tabular-nums">{s?.count ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{s?.bound ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(s?.boundUsd ?? 0)}</TableCell>
                  </TableRow>
                )
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t('cp.none')}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  )
}
