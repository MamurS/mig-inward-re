import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Styled native <select>: accessible, works with react-hook-form register(), good on mobile.
 *
 * A native select paints its value on one line and cuts it («Напрямую (без бр…»).
 * So the select itself is transparent and covers the box (it still takes focus,
 * clicks, typing and the screen reader), and the chosen option's text is painted
 * underneath, where it wraps: a long value is never clipped.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(({ className, children, onChange, ...props }, ref) => {
  const inner = React.useRef<HTMLSelectElement | null>(null)
  const setRef = React.useCallback(
    (el: HTMLSelectElement | null) => {
      inner.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )
  const [label, setLabel] = React.useState('')
  // After every render: the value may have been set from outside (react-hook-form setValue / reset, a controlled value)
  React.useLayoutEffect(() => {
    const text = inner.current?.selectedOptions[0]?.text ?? ''
    if (text !== label) setLabel(text)
  })

  return (
    <div
      data-slot="native-select"
      className={cn(
        'relative flex min-h-10 w-full items-center rounded-control border border-input bg-background py-2 pr-8 pl-3 text-body shadow-xs',
        'has-[select:focus-visible]:border-ring has-[select:focus-visible]:ring-[3px] has-[select:focus-visible]:ring-ring/50',
        'has-[select:disabled]:cursor-not-allowed has-[select:disabled]:opacity-50 has-[select[aria-invalid=true]]:border-destructive',
        className,
      )}
    >
      <span aria-hidden className="min-w-0 leading-snug break-words">{label}</span>
      <select
        ref={setRef}
        className="absolute inset-0 size-full cursor-pointer appearance-none rounded-control text-body opacity-0 outline-none disabled:cursor-not-allowed"
        onChange={(e) => {
          setLabel(e.target.selectedOptions[0]?.text ?? '')
          onChange?.(e)
        }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
})
NativeSelect.displayName = 'NativeSelect'

export { NativeSelect }
