import * as React from 'react'
import { Popover as P } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateInput, formatMonthYear, isoDate, parseDateInput, weekdaysShort } from '@/lib/format'

type DateInputProps = Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'min' | 'max' | 'defaultValue'> & {
  /** ISO date (YYYY-MM-DD) or '' */
  value: string | null | undefined
  /** Called with an ISO date, or '' when the field is cleared */
  onChange: (iso: string) => void
  min?: string
  max?: string
}

/**
 * The app's date field, in place of the browser's own: the date is shown and
 * typed the way the UI language writes it (31.12.2027 in RU / UZ, 31/12/2027 in
 * EN; ISO 2027-12-31 is accepted too), and a calendar opens from the button. The
 * value in and out is always ISO. With react-hook-form, use it through a Controller.
 */
const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(({ value, onChange, onBlur, min, max, className, disabled, ...props }, ref) => {
  const { t, i18n } = useTranslation()
  const iso = value ?? ''
  const [text, setText] = React.useState(() => formatDateInput(iso))
  const [open, setOpen] = React.useState(false)
  const inRange = (d: string) => (!min || d >= min) && (!max || d <= max)

  // A new value from outside (or a new UI language): show it, unless the text already says it
  React.useEffect(() => {
    setText((cur) => (parseDateInput(cur) === iso && iso ? cur : formatDateInput(iso)))
  }, [iso, i18n.resolvedLanguage])

  const typed = (s: string) => {
    setText(s)
    if (s.trim() === '') return onChange('')
    const d = parseDateInput(s)
    if (d && inRange(d) && d !== iso) onChange(d)
  }

  return (
    <div className={cn('relative w-full min-w-0', className)} data-slot="date-input">
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={t('ui.date.pattern')}
        value={text}
        disabled={disabled}
        onChange={(e) => typed(e.target.value)}
        onBlur={(e) => {
          // what is left in the field is always the stored date, in the language's format
          setText(formatDateInput(iso))
          onBlur?.(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && e.altKey) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="flex h-10 w-full min-w-0 rounded-control border border-input bg-background py-1 pr-10 pl-3 text-body shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 num"
        {...props}
      />
      <P.Root open={open} onOpenChange={setOpen}>
        <P.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={t('ui.date.openCalendar')}
            className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none"
          >
            <CalendarDays className="size-4" />
          </button>
        </P.Trigger>
        <P.Portal>
          <P.Content align="end" sideOffset={4} className="z-50 rounded-xl border bg-popover p-3 text-popover-foreground shadow-pop outline-none" onOpenAutoFocus={(e) => {
              // into the selected (or today's) day, so the arrows work at once — also inside a dialog
              e.preventDefault()
              ;(e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>('[data-day][tabindex="0"]')?.focus()
            }}>
            <Calendar
              value={iso}
              min={min}
              max={max}
              onPick={(d) => {
                setText(formatDateInput(d))
                if (d !== iso) onChange(d)
                setOpen(false)
              }}
            />
          </P.Content>
        </P.Portal>
      </P.Root>
    </div>
  )
})
DateInput.displayName = 'DateInput'

/** A month of days, Monday first. Arrows move by a day / week, PageUp / PageDown by a month, Enter picks. */
function Calendar({ value, min, max, onPick }: { value: string; min?: string; max?: string; onPick: (iso: string) => void }) {
  const { t } = useTranslation()
  const today = isoDate()
  const [focus, setFocus] = React.useState(() => value || today)
  const grid = React.useRef<HTMLDivElement>(null)
  const y = Number(focus.slice(0, 4))
  const m = Number(focus.slice(5, 7)) - 1
  const first = new Date(y, m, 1)
  const lead = (first.getDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, i) => isoDate(new Date(y, m, 1 - lead + i)))
  const weeks = Array.from({ length: days[35].slice(5, 7) === focus.slice(5, 7) ? 6 : 5 }, (_, w) => days.slice(w * 7, w * 7 + 7))
  const allowed = (d: string) => (!min || d >= min) && (!max || d <= max)
  const shift = (iso: string, dd: number, mm = 0) => {
    const d = new Date(`${iso}T00:00:00`)
    if (mm) {
      const day = d.getDate()
      d.setDate(1)
      d.setMonth(d.getMonth() + mm)
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
    } else d.setDate(d.getDate() + dd)
    return isoDate(d)
  }

  // keyboard focus follows the focused day (on opening, the popover puts it there)
  const opened = React.useRef(false)
  React.useEffect(() => {
    if (opened.current) grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus()
    opened.current = true
  }, [focus])

  const onKey = (e: React.KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => shift(focus, -1),
      ArrowRight: () => shift(focus, 1),
      ArrowUp: () => shift(focus, -7),
      ArrowDown: () => shift(focus, 7),
      PageUp: () => shift(focus, 0, e.shiftKey ? -12 : -1),
      PageDown: () => shift(focus, 0, e.shiftKey ? 12 : 1),
      Home: () => shift(focus, -((new Date(`${focus}T00:00:00`).getDay() + 6) % 7)),
      End: () => shift(focus, 6 - ((new Date(`${focus}T00:00:00`).getDay() + 6) % 7)),
    }
    if (moves[e.key]) {
      e.preventDefault()
      setFocus(moves[e.key]())
    }
  }

  const navBtn = 'flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'
  return (
    <div className="grid w-72 gap-2" data-calendar>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className={navBtn} aria-label={t('ui.date.prevMonth')} onClick={() => setFocus(shift(focus, 0, -1))}>
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-body font-medium" aria-live="polite">{formatMonthYear(y, m)}</span>
        <button type="button" className={navBtn} aria-label={t('ui.date.nextMonth')} onClick={() => setFocus(shift(focus, 0, 1))}>
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div role="grid" aria-label={formatMonthYear(y, m)} ref={grid} onKeyDown={onKey} className="grid gap-1">
        <div role="row" className="grid grid-cols-7 gap-1">
          {weekdaysShort().map((w) => (
            <span key={w} role="columnheader" className="text-center text-caption text-muted-foreground">{w}</span>
          ))}
        </div>
        {weeks.map((week) => (
          <div role="row" key={week[0]} className="grid grid-cols-7 gap-1">
            {week.map((d) => {
              const outside = d.slice(5, 7) !== focus.slice(5, 7)
              const selected = d === value
              const ok = allowed(d)
              return (
                <span role="gridcell" key={d} aria-selected={selected}>
                  <button
                    type="button"
                    data-day={d}
                    tabIndex={d === focus ? 0 : -1}
                    disabled={!ok}
                    aria-label={formatDateInput(d)}
                    aria-current={d === today ? 'date' : undefined}
                    onClick={() => onPick(d)}
                    className={cn(
                      'flex size-9 w-full items-center justify-center rounded-md text-body num transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
                      outside && 'text-muted-foreground',
                      d === today && !selected && 'font-semibold text-primary',
                      selected && 'bg-primary text-primary-foreground hover:bg-primary',
                    )}
                  >
                    {Number(d.slice(8, 10))}
                  </button>
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <button type="button" className="rounded-md px-2 py-1 text-small text-link hover:underline disabled:opacity-40" disabled={!allowed(today)} onClick={() => onPick(today)}>
          {t('ui.date.today')}
        </button>
      </div>
    </div>
  )
}

export { DateInput }
