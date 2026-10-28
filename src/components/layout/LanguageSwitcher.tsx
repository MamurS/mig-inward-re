import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LANGUAGES, type LanguageCode } from '@/i18n'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'

export function LanguageSwitcher({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const current = (i18n.resolvedLanguage ?? 'en') as LanguageCode

  async function change(code: string) {
    await i18n.changeLanguage(code)
    if (profile && profile.preferred_language !== code) {
      const { error } = await supabase.from('profiles').update({ preferred_language: code }).eq('id', profile.id)
      if (!error) void queryClient.invalidateQueries({ queryKey: ['profile', profile.id] })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" aria-label={t('common.language')}>
          <Languages />
          {LANGUAGES.find((l) => l.code === current)?.short ?? 'EN'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('common.language')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={current} onValueChange={change}>
          {LANGUAGES.map((l) => (
            <DropdownMenuRadioItem key={l.code} value={l.code}>
              {l.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
