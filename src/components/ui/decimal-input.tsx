import * as React from 'react'
import { Input } from '@/components/ui/input'
import { reformatDecimalInput, type NumberKind } from '@/lib/decimal'

/** Set an input's text the way typing does, so React's onChange (and react-hook-form) see it. */
function setTypedValue(el: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * A text input for a number. Anything readable is accepted while typing
 * («1,5», «1 234 567,89», «1,234,567.89»); when the field loses focus it shows
 * the number as it was read, in the interface language, so a wrong reading is
 * visible at once. The value the form keeps is the text; it is turned into a
 * plain decimal with cleanDecimal() from src/lib/decimal.ts on save.
 */
function DecimalInput({ kind = 'amount', onBlur, ...props }: React.ComponentProps<'input'> & { kind?: NumberKind }) {
  return (
    <Input
      inputMode={kind === 'int' ? 'numeric' : 'decimal'}
      autoComplete="off"
      data-number={kind}
      {...props}
      onBlur={(e) => {
        const el = e.currentTarget
        const shown = reformatDecimalInput(el.value, kind)
        if (shown !== el.value) setTypedValue(el, shown)
        onBlur?.(e)
      }}
    />
  )
}

export { DecimalInput }
