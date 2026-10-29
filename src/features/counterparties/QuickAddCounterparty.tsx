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
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import type { Enums } from '@/lib/database.types'
import { useCountries, useLocalName } from '@/hooks/useReference'

/** Small "+ new MGA / broker" dialog used inside the submission form. */
export function QuickAddCounterparty({
  type,
  onCreated,
}: {
  type: Enums<'counterparty_type'>
  onCreated: (id: string) => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const countries = useCountries()
  const localName = useLocalName()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!name.trim()) return
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
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" title={t(`cp.add.${type}`)} aria-label={t(`cp.add.${type}`)}>
          <Plus />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`cp.add.${type}`)}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
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
          <Button onClick={() => void save()} disabled={busy || !name.trim()}>
            {busy && <Loader2 className="animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
