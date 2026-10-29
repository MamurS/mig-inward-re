import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The inline success check: a small «Saved ✓» next to the button that did
 * it, for 2 s. Its space is always reserved, so it never moves the layout.
 */
export function SavedCheck({ show, label, className }: { show: boolean; label?: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1 text-caption font-medium text-success-700 transition-opacity duration-(--duration-moderate-01)',
        show ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      <Check className="size-4" />
      {show ? (label ?? t('ui.saved')) : <span className="invisible">{label ?? t('ui.saved')}</span>}
    </span>
  )
}

/** `[shown, flash]` — call `flash()` after a successful save. */
export function useFlash(ms = 2000): [boolean, () => void] {
  const [on, setOn] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const flash = useCallback(() => {
    clearTimeout(timer.current)
    setOn(true)
    timer.current = setTimeout(() => setOn(false), ms)
  }, [ms])
  return [on, flash]
}
