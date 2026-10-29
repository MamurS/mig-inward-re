import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUSES } from '@/lib/status'
import { cssOklch, hexToOklch } from '@/design/oklch'
import {
  AGING_COLORS,
  CANVAS,
  CATEGORICAL,
  GRAPHIC_MIN,
  MOTION,
  RAMPS,
  SEQUENTIAL,
  SPACING_STEPS,
  STATUS_COLORS,
  STEPS,
  TEXT_MIN,
  TYPE_SCALE,
  contrast,
  luminance,
  worstContrastAt,
  type AgingKey,
  type RampName,
} from '@/design/palette'

/**
 * The design tokens, live (DESIGN.md). Admin only: a reference for whoever
 * builds or reviews a screen — every colour with its OKLCH and hex value and
 * contrast, the domain scales, type, spacing and motion.
 */

/** Literal classes, so Tailwind generates them. */
const TYPE_CLASS: Record<keyof typeof TYPE_SCALE, string> = {
  caption: 'text-caption',
  small: 'text-small',
  body: 'text-body',
  lead: 'text-lead',
  title: 'text-title',
  headline: 'font-display-bold text-headline',
  display: 'font-display-bold text-display',
}

const AGING_KEYS: AgingKey[] = ['0-30', '31-60', '61-90', '90+']
const RAMP_NAMES = Object.keys(RAMPS) as RampName[]
const WHITE = 'rgb(255 255 255)'
const INK = RAMPS.slate[900]

/** White or near-black, whichever reads on the swatch. */
const inkOn = (hex: string) => (luminance(hex) > 0.18 ? INK : WHITE)
const ratio = (a: string, b: string) => contrast(a, b).toFixed(2)

function Swatch({ hex, label, sub }: { hex: string; label: string; sub?: string }) {
  return (
    <div className="grid min-w-0 gap-1">
      <div className="flex h-14 items-end rounded-md border p-2" style={{ background: hex, color: inkOn(hex) }}>
        <span className="text-caption font-medium">{label}</span>
      </div>
      <div className="truncate text-caption text-muted-foreground num" title={sub ? `${hex} · ${sub}` : hex}>{hex}</div>
      {sub && <div className="truncate text-caption text-muted-foreground num" title={sub}>{sub}</div>}
    </div>
  )
}

export function TokensPage() {
  const { t } = useTranslation()
  const [moved, setMoved] = useState(false)
  const text = worstContrastAt(5)
  const icon = worstContrastAt(4)

  return (
    <>
      <PageHeader title={t('tokens.title')} subtitle={t('tokens.subtitle')} />

      <div className="grid gap-4">
        <Card>
          <CardHeader><CardTitle>{t('tokens.ramps')}</CardTitle></CardHeader>
          <CardContent className="grid gap-6">
            <p className="text-body text-muted-foreground">
              {t('tokens.pairing', { text: text.ratio.toFixed(2), icon: icon.ratio.toFixed(2), tmin: TEXT_MIN, gmin: GRAPHIC_MIN })}
            </p>
            {RAMP_NAMES.map((name) => (
              <div key={name} className="grid gap-2">
                <div className="text-body font-medium">{name}</div>
                <div className="grid grid-cols-5 gap-2 lg:grid-cols-10">
                  {STEPS.map((step) => {
                    const hex = RAMPS[name][step]
                    return <Swatch key={step} hex={hex} label={String(step)} sub={cssOklch(hexToOklch(hex))} />
                  })}
                </div>
              </div>
            ))}
            <div className="grid max-w-40 gap-2">
              <div className="text-body font-medium">{t('tokens.canvas')}</div>
              <Swatch hex={CANVAS} label="canvas" sub={`${ratio(RAMPS.slate[500], CANVAS)} : 1 slate-500`} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{t('tokens.statusScale')}</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {STATUSES.map((s) => {
                const c = STATUS_COLORS[s]
                return (
                  <div key={s} className="grid grid-cols-[10rem_1fr] items-center gap-3">
                    <StatusBadge status={s} />
                    <div className="flex items-center gap-2 text-caption text-muted-foreground num">
                      <span className="inline-block size-4 rounded-sm" style={{ background: c.solid }} />
                      {t('tokens.inkOnTint')} {ratio(c.deep, c.tint)} · {t('tokens.solidOnWhite')} {ratio(c.solid, '#ffffff')}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('tokens.agingScale')}</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {AGING_KEYS.map((k) => {
                const c = AGING_COLORS[k]
                const solid = k === '90+'
                return (
                  <div key={k} className="grid grid-cols-[10rem_1fr] items-center gap-3">
                    <span
                      className="inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-caption font-medium num"
                      style={solid ? { background: c.ink, color: WHITE, borderColor: c.ink } : { background: c.tint, color: c.deep, borderColor: c.line }}
                    >
                      {t('tokens.days', { range: k })}
                    </span>
                    <span className="text-caption text-muted-foreground num">
                      {solid ? `${t('tokens.whiteOnSolid')} ${ratio('#ffffff', c.ink)}` : `${t('tokens.inkOnTint')} ${ratio(c.deep, c.tint)}`}
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>{t('tokens.data')}</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
              {CATEGORICAL.map((hex, i) => <Swatch key={hex} hex={hex} label={`data-${i + 1}`} sub={`${ratio(hex, '#ffffff')} : 1`} />)}
            </div>
            <div className="grid grid-cols-9 gap-2">
              {SEQUENTIAL.map((hex, i) => <Swatch key={hex} hex={hex} label={`seq-${i + 1}`} />)}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{t('tokens.type')}</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {(Object.keys(TYPE_SCALE) as (keyof typeof TYPE_SCALE)[]).map((k) => (
                <div key={k} className="grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-3">
                  <span className="text-caption text-muted-foreground num">{k} · {Number.parseFloat(TYPE_SCALE[k][0]) * 16}px</span>
                  <span className={`truncate ${TYPE_CLASS[k]}`}>{t('tokens.sample')}</span>
                </div>
              ))}
              <div className="grid gap-1 border-t pt-3">
                <span className="text-caption text-muted-foreground">{t('tokens.glyphs')}</span>
                <span className="text-lead">Oʻzbekiston · gʻalla · Gʻafur · Oʻrta Osiyo · qoʻshimcha ’</span>
                <span className="text-lead">Ўзбекистон · ғалла · қўшимча · ҳисоб · Съешь же ещё этих мягких булок</span>
                <span className="font-display-bold text-headline">Oʻzbekiston · Ўзбекистон 1 234 567,89</span>
                <span className="text-lead num">0123456789 · 1,234,567.89 · 98.76%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('tokens.spaceMotion')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-1">
                {SPACING_STEPS.map((s) => (
                  <div key={s} className="grid grid-cols-[4rem_1fr] items-center gap-3">
                    <span className="text-caption text-muted-foreground num">{s * 4}px</span>
                    <span className="h-2 rounded-sm bg-sky-400" style={{ width: `${s * 4}px` }} />
                  </div>
                ))}
              </div>
              <div className="grid gap-2 border-t pt-3">
                <Button variant="outline" className="w-fit" onClick={() => setMoved((m) => !m)}>{t('tokens.playMotion')}</Button>
                {Object.entries(MOTION.durations).map(([name, ms]) => (
                  <div key={name} className="grid grid-cols-[8rem_1fr] items-center gap-3">
                    <span className="text-caption text-muted-foreground num">{name} · {ms}</span>
                    <div className="h-4 rounded-sm bg-slate-100">
                      <div
                        className="size-4 rounded-sm bg-navy-600"
                        style={{
                          transform: moved ? 'translateX(12rem)' : 'none',
                          transitionProperty: 'transform',
                          transitionDuration: ms,
                          transitionTimingFunction: MOTION.easings['productive-standard'],
                        }}
                      />
                    </div>
                  </div>
                ))}
                <span className="text-caption text-muted-foreground">{t('tokens.reducedMotion')}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="py-4"><CardTitle>{t('tokens.sampleTable')}</CardTitle></CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fields.refNo')}</TableHead>
                <TableHead>{t('fields.status')}</TableHead>
                <TableHead className="text-right">{t('tokens.amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STATUSES.slice(0, 4).map((s, i) => (
                <TableRow key={s}>
                  <TableCell className="font-medium num">SUB-2026-{String(i + 1).padStart(4, '0')}</TableCell>
                  <TableCell><StatusBadge status={s} /></TableCell>
                  <TableCell className="text-right num">{(125000 * (i + 1)).toLocaleString('en-US')}.00</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  )
}
