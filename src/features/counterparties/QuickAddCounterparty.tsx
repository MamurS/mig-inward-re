import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field } from '@/components/Field'
import { SegmentedControl } from '@/components/SegmentedControl'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import type { Enums } from '@/lib/database.types'
import { useCountries, useLocalName } from '@/hooks/useReference'

type CpType = Enums<'counterparty_type'>
const TYPES: CpType[] = ['mga', 'broker', 'cedent']

/**
 * A short «new counterparty» dialog. With a fixed `type` (inside the
 * submission form) it opens from a small + button; without one (the
 * counterparties page) it is the page's primary «New counterparty» button and
 * asks for the type first.
 */
export function QuickAddCounterparty({
  type: fixedType,
  onCreated,
}: {
  type?: CpType
  onCreated: (id: string) => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const countries = useCountries()
  const localName = useLocalName()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [chosen, setChosen] = useState<CpType | ''>('')
  const [busy, setBusy] = useState(false)
  const type = fixedType ?? chosen

  async function save() {
    if (!name.trim() || !type) return
    setBusy(true)
    const { data, error } = await supabase
      .from('counterparties')
      .insert({ name: name.trim(), type, country_code: country || null })
      .select('id')
      .single()
    setBusy(false)
    if (error) {
      toast.error(/duplicate key/i.test(error.message) ? t('cp.duplicate') : errorMessage(error))
      return
    }
    await qc.invalidateQueries({ queryKey: ['ref', 'counterparties'] })
    onCreated(data.id)
    toast.success(t('cp.created', { name: name.trim() }))
    setName('')
    setCountry('')
    setChosen('')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {fixedType ? (
          <Button type="button" variant="outline" size="icon" title={t(`cp.add.${fixedType}`)} aria-label={t(`cp.add.${fixedType}`)}>
            <Plus />
          </Button>
        ) : (
          <Button type="button">
            <Plus />
            {t('cp.new')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fixedType ? t(`cp.add.${fixedType}`) : t('cp.new')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {!fixedType && (
            <Field label={t('cp.type')} required>
              <SegmentedControl
                ariaLabel={t('cp.type')}
                value={chosen || ('' as CpType)}
                onChange={(v) => setChosen(v)}
                options={TYPES.map((tp) => ({ value: tp, label: t(`counterpartyType.${tp}`) }))}
              />
            </Field>
          )}
          <Field label={t('fields.name')} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void save())} />
          </Field>
          <Field label={t('fields.country')}>
            <NativeSelect value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">—</option>
              {countries.data?.map((c) => <option key={c.code} value={c.code}>{localName(c)}</option>)}
            </NativeSelect>
          </Field>
          <p className="text-caption text-muted-foreground">{t('cp.moreLater')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={busy || !name.trim() || !type}>
            {busy && <Loader2 className="animate-spin" />}
            {type ? t(`cp.add.${type}`) : t('cp.new')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
