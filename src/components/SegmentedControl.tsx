import { cn } from '@/lib/utils'

/**
 * A choice of 2–5 options shown all at once (instead of a dropdown): one
 * click, and every option stays visible. Keyboard: arrows move, as a radio group.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'md',
  className,
  id,
}: {
  value: T | null | undefined
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  ariaLabel?: string
  size?: 'sm' | 'md'
  className?: string
  id?: string
}) {
  const move = (dir: 1 | -1) => {
    const i = options.findIndex((o) => o.value === value)
    const next = options[(i + dir + options.length) % options.length]
    onChange(next.value)
    requestAnimationFrame(() => document.getElementById(`${id ?? ariaLabel}-${next.value}`)?.focus())
  }
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      id={id}
      className={cn('inline-flex w-fit flex-wrap gap-1 rounded-md border bg-muted p-0.5', className)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
      }}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            id={`${id ?? ariaLabel}-${o.value}`}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (!value && o === options[0]) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-sm px-3 font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-7 text-caption' : 'h-8 text-body',
              on ? 'bg-background text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
