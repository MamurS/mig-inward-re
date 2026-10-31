import type { ReactNode } from 'react'

/**
 * A name with a grey second line under it (the insured with its MGA, a payer
 * with its type): one column instead of two, so names are not cut off. Both
 * lines truncate with an ellipsis; the full text is in the tooltip. The cell
 * itself needs a max width (e.g. `className: 'max-w-64'` on the column).
 */
export function NameCell({ name, sub, title }: { name: ReactNode; sub?: ReactNode; title?: string }) {
  return (
    <span className="block min-w-0" title={title}>
      <span className="block truncate">{name}</span>
      {sub && <span className="block truncate text-caption text-muted-foreground">{sub}</span>}
    </span>
  )
}
