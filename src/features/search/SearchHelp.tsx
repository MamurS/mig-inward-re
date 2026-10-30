import { useTranslation } from 'react-i18next'
import { Popover as P } from 'radix-ui'
import { CornerDownLeft } from 'lucide-react'

/** The syntax, by example — each example can be tried in one click. */
const EXAMPLES = [
  { q: 'evon', key: 'text' },
  { q: '"Yigit Agro"', key: 'phrase' },
  { q: 'Sevil, property, bound', key: 'and' },
  { q: 'Sevil, bound; IUC, offered', key: 'or' },
  { q: 'status:offered|bound', key: 'pipe' },
  { q: '-declined', key: 'exclude' },
  { q: 'mga:Sevil, ccy:USD', key: 'fields' },
  { q: 'premium>100k, share>=10', key: 'numbers' },
  { q: 'received>=2026-10-01', key: 'dates' },
  { q: 'expiry<30d', key: 'within' },
  { q: 'overdue, mine', key: 'keywords' },
] as const

export function SearchHelp({ open, onOpenChange, onTry }: { open: boolean; onOpenChange: (o: boolean) => void; onTry: (q: string) => void }) {
  const { t } = useTranslation()
  return (
    <P.Root open={open} onOpenChange={onOpenChange}>
      <P.Anchor className="absolute inset-x-0 top-full h-0" />
      <P.Portal>
        <P.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 grid max-h-[70vh] w-[min(36rem,calc(100vw-2rem))] gap-3 overflow-y-auto rounded-2xl border bg-popover p-5 text-popover-foreground shadow-pop outline-none duration-(--duration-moderate-01) data-[state=open]:animate-in data-[state=open]:fade-in-0"
          aria-label={t('search.help.title')}
        >
          <div>
            <h2 className="text-title font-semibold">{t('search.help.title')}</h2>
            <p className="mt-1 text-small text-muted-foreground">{t('search.help.intro')}</p>
          </div>
          <ul className="grid gap-1">
            {EXAMPLES.map((e) => (
              <li key={e.key}>
                <button
                  type="button"
                  onClick={() => onTry(e.q)}
                  className="group grid w-full grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] items-baseline gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-brand-50"
                >
                  <code className="truncate rounded-sm bg-muted px-2 py-0.5 font-mono text-small text-foreground" title={e.q}>{e.q}</code>
                  <span className="text-small text-muted-foreground">{t(`search.help.ex.${e.key}`)}</span>
                  <CornerDownLeft className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-small text-muted-foreground">{t('search.help.fields')}</p>
          <p className="text-small text-muted-foreground">{t('search.help.languages')}</p>
        </P.Content>
      </P.Portal>
    </P.Root>
  )
}
