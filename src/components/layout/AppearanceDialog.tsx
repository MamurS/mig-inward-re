import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/Field'
import { SegmentedControl } from '@/components/SegmentedControl'
import { SavedCheck, useFlash } from '@/components/SavedCheck'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { THEMES as THEME_COLORS } from '@/design/palette'
import { applyAppearance, normalizeAppearance, THEMES, TEXT_SIZES, type Appearance } from '@/lib/appearance'

/** Keeps <html data-theme / data-text-size> in step with the signed-in user's profile. */
export function AppearanceSync() {
  const { profile } = useAuth()
  useEffect(() => {
    if (profile) applyAppearance(normalizeAppearance(profile.ui_theme, profile.ui_text_size))
  }, [profile])
  return null
}

/**
 * Appearance (user menu): colour theme and text size, applied at once and
 * saved on the user's profile. Previews are drawn from the theme's own tokens.
 */
export function AppearanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [shown, flash] = useFlash()
  const [value, setValue] = useState<Appearance>(normalizeAppearance(profile?.ui_theme, profile?.ui_text_size))

  useEffect(() => {
    if (open) setValue(normalizeAppearance(profile?.ui_theme, profile?.ui_text_size))
  }, [open, profile])

  async function choose(next: Appearance) {
    const before = value
    setValue(next)
    applyAppearance(next, { fade: true })
    if (!profile) return
    const { error } = await supabase.from('profiles').update({ ui_theme: next.theme, ui_text_size: next.textSize }).eq('id', profile.id)
    if (error) {
      setValue(before)
      applyAppearance(before, { fade: true })
      toast.error(errorMessage(error))
      return
    }
    await qc.invalidateQueries({ queryKey: ['profile', profile.id] })
    flash()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('appearance.title')}</DialogTitle>
          <DialogDescription>{t('appearance.subtitle')}</DialogDescription>
        </DialogHeader>

        <Field label={t('appearance.theme')}>
          <div role="radiogroup" aria-label={t('appearance.theme')} className="grid grid-cols-2 gap-3">
            {THEMES.map((theme) => {
              const c = THEME_COLORS[theme]
              const on = value.theme === theme
              return (
                <button
                  key={theme}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => void choose({ ...value, theme })}
                  className={cn(
                    'group grid gap-2 rounded-xl border p-3 text-left transition-colors hover:border-input',
                    on && 'border-primary ring-2 ring-ring/40',
                  )}
                >
                  {/* a miniature of the app in that theme */}
                  <span aria-hidden className="flex h-16 overflow-hidden rounded-lg border" style={{ background: c.canvas }}>
                    <span className="flex w-1/3 flex-col gap-1 border-r p-2" style={{ background: c.sidebar }}>
                      <span className="h-2 rounded-sm" style={{ background: c.brand[100] }} />
                      <span className="h-1.5 w-3/4 rounded-sm bg-slate-200" />
                      <span className="h-1.5 w-2/3 rounded-sm bg-slate-200" />
                    </span>
                    <span className="flex flex-1 flex-col gap-1 p-2">
                      <span className="h-2 w-1/2 rounded-sm bg-slate-300" />
                      <span className="h-6 rounded-sm bg-white" />
                      <span className="h-2 w-8 rounded-sm" style={{ background: c.brand[600] }} />
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2 text-body font-medium">
                    {t(`appearance.themes.${theme}`)}
                    {on && <Check className="size-4 text-primary" />}
                  </span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label={t('appearance.textSize')} hint={t('appearance.textSizeHint')}>
          <SegmentedControl
            ariaLabel={t('appearance.textSize')}
            value={value.textSize}
            onChange={(textSize) => void choose({ ...value, textSize })}
            options={TEXT_SIZES.map((s) => ({ value: s, label: t(`appearance.sizes.${s}`) }))}
          />
        </Field>

        <SavedCheck show={shown} />
      </DialogContent>
    </Dialog>
  )
}
