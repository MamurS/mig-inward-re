import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SkeletonRows } from '@/components/Skeleton'
import { usePref } from '@/lib/prefs'
import { cn } from '@/lib/utils'

/**
 * Table v2 (DESIGN.md «Tables»): regular rows of 48 px, sticky header, frozen first column, column show / hide, row actions
 * on hover, a bulk bar for selected rows, search highlight (columns call
 * `ctx.hl(text)`), skeleton rows while loading. Sorting stays with the page
 * (it usually lives in the URL); the table only draws the headers.
 */

const ROW_H = 'h-12'

export interface CellContext {
  /** Highlights the current search in `text`. */
  hl: (text: string | null | undefined) => ReactNode
}

export interface Column<T> {
  id: string
  header: string
  cell: (row: T, ctx: CellContext) => ReactNode
  align?: 'left' | 'right'
  /** Sort key the page understands; omitted = not sortable. */
  sortKey?: string
  /** The first column is always shown; others can be hidden unless `hideable: false`. */
  hideable?: boolean
  /** Hidden until the user turns it on. */
  defaultHidden?: boolean
  className?: string
}

export function DataTable<T>({
  id,
  columns,
  rows,
  getRowId,
  loading = false,
  empty,
  sort,
  onSort,
  onRowClick,
  rowActions,
  bulkActions,
  hl,
  toolbar,
  footer,
  maxHeight = 'max-h-[calc(100vh-14rem)]',
  className,
}: {
  /** Names the stored preference (hidden columns). */
  id: string
  columns: Column<T>[]
  rows: T[]
  getRowId: (row: T) => string
  loading?: boolean
  empty?: ReactNode
  sort?: { key: string; dir: 'asc' | 'desc' }
  onSort?: (key: string) => void
  onRowClick?: (row: T) => void
  rowActions?: (row: T) => ReactNode
  /** Rendered in the floating bar while rows are selected; turns on row selection. */
  bulkActions?: (selected: T[], clear: () => void) => ReactNode
  hl?: (text: string | null | undefined) => ReactNode
  toolbar?: ReactNode
  footer?: ReactNode
  maxHeight?: string
  className?: string
}) {
  const { t } = useTranslation()
  const defaultHidden = useMemo(() => columns.filter((c) => c.defaultHidden).map((c) => c.id), [columns])
  const [hidden, setHidden] = usePref<string[]>(`table.${id}.hidden`, defaultHidden)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const visible = columns.filter((c, i) => i === 0 || !hidden.includes(c.id))
  const selectable = Boolean(bulkActions)
  const ctx: CellContext = { hl: hl ?? ((x) => x) }
  const rowIds = rows.map(getRowId)
  const selectedRows = rows.filter((r) => selected.has(getRowId(r)))
  const allOn = rows.length > 0 && selectedRows.length === rows.length
  const clear = () => setSelected(new Set())
  const toggle = (rid: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(rid)) n.delete(rid)
      else n.add(rid)
      return n
    })

  // the frozen first column shows its divider only while the table is scrolled sideways (then it is needed)
  const divider = 'group-data-[scrolled-x=true]/scroll:shadow-[inset_-1px_0_0_var(--color-border)]'
  const frozen = `sticky left-0 z-[1] bg-card ${divider} group-hover/row:bg-slate-50 group-data-[selected=true]/row:bg-brand-50`
  const [scrolledX, setScrolledX] = useState(false)
  // more columns to the right than the card shows: a soft edge says the table scrolls (nothing is cut off silently)
  const [moreX, setMoreX] = useState(false)
  const scrollBox = useRef<HTMLDivElement>(null)
  const measureX = useCallback(() => {
    const el = scrollBox.current
    if (el) setMoreX(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])
  useEffect(() => {
    const el = scrollBox.current
    if (!el) return
    measureX()
    const ro = new ResizeObserver(measureX)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [measureX, rows, hidden, loading])
  const headCell = 'sticky top-0 z-[2] h-11 border-b bg-card px-3 text-left align-middle text-small leading-tight font-medium text-muted-foreground'

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-caption text-muted-foreground">{toolbar}</div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={t('ui.columns')}>
                <Columns3 />
                <span className="hidden sm:inline">{t('ui.columns')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
              <DropdownMenuLabel>{t('ui.showColumns')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((c, i) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={i === 0 || !hidden.includes(c.id)}
                  disabled={i === 0 || c.hideable === false}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(on) => setHidden(on ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])}
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setHidden(defaultHidden)}>
                <RotateCcw />
                {t('ui.resetColumns')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollBox}
          className={cn('group/scroll relative overflow-auto outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', maxHeight)}
          tabIndex={0}
          data-scrolled-x={scrolledX}
          data-table-scroll
          onScroll={(e) => {
            const x = e.currentTarget.scrollLeft > 0
            if (x !== scrolledX) setScrolledX(x)
            measureX()
          }}
        >
          <table className="w-full caption-bottom border-separate border-spacing-0 text-table">
            <thead>
              <tr>
                {visible.map((c, i) => {
                  const sorted = sort && c.sortKey && sort.key === c.sortKey
                  const label = c.sortKey && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.sortKey!)}
                      className={cn('inline-flex items-center gap-1 rounded-sm hover:text-foreground', c.align === 'right' && 'flex-row-reverse')}
                    >
                      {c.header}
                      {sorted ? (sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ChevronsUpDown className="size-3 opacity-40" />}
                    </button>
                  ) : (
                    c.header
                  )
                  return (
                    <th
                      key={c.id}
                      className={cn(headCell, c.align === 'right' && 'text-right', i === 0 && cn('left-0 z-[3]', divider))}
                      aria-sort={sorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      {i === 0 && selectable ? (
                        <span className="inline-flex items-center gap-3">
                          <input
                            type="checkbox"
                            aria-label={t('ui.selectAll')}
                            className="size-4 accent-brand-600"
                            checked={allOn}
                            ref={(el) => {
                              if (el) el.indeterminate = selectedRows.length > 0 && !allOn
                            }}
                            onChange={() => setSelected(allOn ? new Set() : new Set(rowIds))}
                          />
                          {label}
                        </span>
                      ) : (
                        label
                      )}
                    </th>
                  )
                })}
                {/* row actions take no width: they float over the row's end on hover / focus */}
                {rowActions && <th className={cn(headCell, 'right-0 z-[3] w-0 p-0')}><span className="sr-only">{t('ui.actions')}</span></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={8} cols={visible.length + (rowActions ? 1 : 0)} rowClassName={ROW_H} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={visible.length + (rowActions ? 1 : 0)}>{empty}</td>
                </tr>
              ) : (
                rows.map((r) => {
                  const rid = getRowId(r)
                  const on = selected.has(rid)
                  return (
                    <tr
                      key={rid}
                      data-selected={on}
                      className={cn('group/row transition-colors hover:bg-slate-50 data-[selected=true]:bg-brand-50', ROW_H, onRowClick && 'cursor-pointer')}
                      onClick={onRowClick ? () => onRowClick(r) : undefined}
                    >
                      {visible.map((c, i) => (
                        <td
                          key={c.id}
                          className={cn('border-b px-3 align-middle whitespace-nowrap', c.align === 'right' && 'text-right num', i === 0 && frozen, c.className)}
                        >
                          {i === 0 && selectable ? (
                            <span className="inline-flex items-center gap-3">
                              <input
                                type="checkbox"
                                aria-label={t('ui.selectRow')}
                                className="size-4 accent-brand-600"
                                checked={on}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggle(rid)}
                              />
                              {c.cell(r, ctx)}
                            </span>
                          ) : (
                            c.cell(r, ctx)
                          )}
                        </td>
                      ))}
                      {rowActions && (
                        <td
                          className="sticky right-0 w-0 border-b bg-transparent p-0 align-middle whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center justify-end gap-1 rounded-md bg-card opacity-0 shadow-card transition-opacity group-hover/row:opacity-100 focus-within:opacity-100 group-data-[selected=true]/row:opacity-100">
                            {rowActions(r)}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {moreX && <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-[4] w-6 bg-linear-to-l from-slate-900/10 to-transparent" data-more-x />}
      </div>
      {footer}

      {selectable && selectedRows.length > 0 && (
        <div
          role="toolbar"
          aria-label={t('ui.bulkActions')}
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-slate-900 py-2 pr-2 pl-4 text-body text-white shadow-pop duration-(--duration-moderate-01) animate-in fade-in-0 slide-in-from-bottom-2"
        >
          <span className="font-medium num">{t('ui.selected', { count: selectedRows.length })}</span>
          <div className="flex items-center gap-1">{bulkActions!(selectedRows, clear)}</div>
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={clear}>
            <X />
            {t('ui.clearSelection')}
          </Button>
        </div>
      )}
    </div>
  )
}
