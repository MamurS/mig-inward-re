/**
 * The colour system (docs/design-research-2026-10.md; same values as the TCI
 * ERP so both MIG systems read as one family). Every ramp is built in OKLCH
 * with ten steps (50 … 900), and every step of every hue has the SAME WCAG
 * relative luminance (`STEP_LUMINANCE`) — so a pair that passes for one hue
 * passes for all, and the pairing rule holds by construction:
 *
 *   * text: steps at least 5 apart (≥ 4.5 : 1);
 *   * icons, large text, graphics: steps at least 4 apart (≥ 3 : 1);
 *   * white and the page canvas count as step 50.
 *
 * Edit here, then `npm run design:tokens` (writes tokens.css, the Tailwind
 * `@theme`); `tokens.test.ts` fails while the two disagree and
 * `contrast.test.ts` proves the rule for the palette and for every colour
 * class in the code.
 */

import { contrast, cssOklch, hexToOklch, luminance, oklchToHex } from './oklch.ts'

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
export type Step = (typeof STEPS)[number]

/** Target relative luminance per step: (Yᵢ + 0.05) / (Yᵢ₊₅ + 0.05) ≥ 4.5 and
 * (Yᵢ + 0.05) / (Yᵢ₊₄ + 0.05) ≥ 3 for every i. */
export const STEP_LUMINANCE = [0.955, 0.885, 0.76, 0.58, 0.26, 0.16, 0.112, 0.073, 0.044, 0.015] as const

/** Share of a ramp's peak chroma per step: tints and shades quieter. */
const CHROMA_SHAPE = [0.12, 0.3, 0.55, 0.8, 1, 1, 0.92, 0.82, 0.7, 0.58] as const

interface RampSpec {
  hue: number
  chroma: number
  role: string
}

/** The ramps. `slate` is the warm neutral, `navy` the brand (reserved for the
 * sidebar, primary actions and selection), `sky` the secondary brand (links,
 * focus, highlights). Semantic ramps carry meaning only; violet / teal /
 * magenta are data series. */
export const RAMP_SPECS = {
  slate: { hue: 70, chroma: 0.012, role: 'neutral — backgrounds, text, borders (≈ 90 % of pixels)' },
  navy: { hue: 250, chroma: 0.13, role: 'brand — sidebar, primary actions, selection, key figures' },
  sky: { hue: 232, chroma: 0.17, role: 'secondary brand — links, focus ring, highlights' },
  success: { hue: 155, chroma: 0.17, role: 'semantic — bound, paid, done' },
  warning: { hue: 70, chroma: 0.17, role: 'semantic — waiting, due soon, attention' },
  danger: { hue: 27, chroma: 0.22, role: 'semantic — error, overdue, declined' },
  info: { hue: 262, chroma: 0.16, role: 'semantic — information, new' },
  violet: { hue: 300, chroma: 0.17, role: 'data — categorical; status «under review»' },
  teal: { hue: 190, chroma: 0.14, role: 'data — categorical' },
  magenta: { hue: 345, chroma: 0.18, role: 'data — categorical' },
} as const satisfies Record<string, RampSpec>

export type RampName = keyof typeof RAMP_SPECS
export type Ramp = Record<Step, string>

/** The lightness that gives a target luminance at a chroma and hue. */
function solveStep(targetY: number, chroma: number, hue: number): string {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (luminance(oklchToHex({ l: mid, c: chroma, h: hue })) < targetY) lo = mid
    else hi = mid
  }
  return oklchToHex({ l: (lo + hi) / 2, c: chroma, h: hue })
}

export function buildRamp(spec: { hue: number; chroma: number }): Ramp {
  return Object.fromEntries(
    STEPS.map((step, i) => [step, solveStep(STEP_LUMINANCE[i], spec.chroma * CHROMA_SHAPE[i], spec.hue)]),
  ) as Ramp
}

export const RAMPS: Record<RampName, Ramp> = Object.fromEntries(
  Object.entries(RAMP_SPECS).map(([name, spec]) => [name, buildRamp(spec)]),
) as Record<RampName, Ramp>

/** The page canvas: a faint warm grey; neutral 500 still reads at 4.5 : 1 on it. */
export const CANVAS = solveStep(0.93, RAMP_SPECS.slate.chroma * 0.2, RAMP_SPECS.slate.hue)

// ---------------------------------------------------------------------------
// Domain scales. Each entry: TINT (badge background, step 100), LINE (hairline,
// step 200), SOLID (bars, dots, chart marks, step 400 — ≥ 3 : 1 on white),
// INK (text on the tint or on white, step 600 — ≥ 4.5 : 1 on both) and DEEP
// (step 700, text on a pale badge).
// ---------------------------------------------------------------------------

export interface ScaleColors {
  tint: string
  line: string
  solid: string
  ink: string
  deep: string
}

function scaleOf(spec: { hue: number; chroma: number }): ScaleColors {
  const r = buildRamp(spec)
  return { tint: r[100], line: r[200], solid: r[400], ink: r[600], deep: r[700] }
}

/** Submission status — one fixed, meaning-based colour each, used on badges,
 * the funnel and charts:
 *   received     info blue   — new, nothing decided yet
 *   under_review violet      — being worked on
 *   offered      amber       — waiting for the market's answer
 *   no_response  orange      — waiting too long
 *   bound        green       — business written
 *   ntu          grey        — closed, not taken up (neutral, not an error)
 *   declined     red         — we said no */
export const STATUS_SPECS = {
  received: { hue: 262, chroma: 0.16 },
  under_review: { hue: 300, chroma: 0.17 },
  offered: { hue: 75, chroma: 0.16 },
  no_response: { hue: 48, chroma: 0.19 },
  bound: { hue: 155, chroma: 0.17 },
  ntu: { hue: 70, chroma: 0.02 },
  declined: { hue: 27, chroma: 0.22 },
} as const

export type StatusKey = keyof typeof STATUS_SPECS
export const STATUS_COLORS = Object.fromEntries(
  Object.entries(STATUS_SPECS).map(([k, spec]) => [k, scaleOf(spec)]),
) as Record<StatusKey, ScaleColors>

/** Overdue ageing, a sequential warm → danger scale (Phase 2 receivables):
 * 0–30 yellow, 31–60 amber, 61–90 orange, 90+ red (the one state that may be
 * drawn as a solid fill). */
export const AGING_SPECS = {
  '0-30': { hue: 92, chroma: 0.16 },
  '31-60': { hue: 70, chroma: 0.17 },
  '61-90': { hue: 48, chroma: 0.19 },
  '90+': { hue: 27, chroma: 0.22 },
} as const

export type AgingKey = keyof typeof AGING_SPECS
export const AGING_COLORS = Object.fromEntries(
  Object.entries(AGING_SPECS).map(([k, spec]) => [k, scaleOf(spec)]),
) as Record<AgingKey, ScaleColors>

// ---------------------------------------------------------------------------
// Data palettes
// ---------------------------------------------------------------------------

/** Categorical series in a fixed order; neighbours differ in hue by ≥ ~60°.
 * All at step 400 (≥ 3 : 1 on white). */
export const CATEGORICAL: readonly string[] = [
  RAMPS.navy[400],
  RAMPS.warning[400],
  RAMPS.teal[400],
  RAMPS.magenta[400],
  RAMPS.sky[400],
  RAMPS.success[400],
  RAMPS.violet[400],
  RAMPS.danger[400],
]

/** Sequential (magnitude): one hue, light to dark — navy 100 … 900. */
export const SEQUENTIAL: readonly string[] = STEPS.slice(1).map((s) => RAMPS.navy[s])

// ---------------------------------------------------------------------------
// The pairing rule
// ---------------------------------------------------------------------------

export const TEXT_MIN = 4.5
export const GRAPHIC_MIN = 3

/** The smallest contrast any two steps `distance` apart reach, over every ramp
 * (with white and the canvas as step 50). */
export function worstContrastAt(distance: number): { ratio: number; where: string } {
  let worst = { ratio: Infinity, where: '' }
  for (const [name, ramp] of Object.entries(RAMPS)) {
    for (let i = 0; i + distance < STEPS.length; i++) {
      const pairs: [string, string, string][] = [[ramp[STEPS[i]], ramp[STEPS[i + distance]], `${name}-${STEPS[i]}/${STEPS[i + distance]}`]]
      if (i === 0) {
        pairs.push(['#ffffff', ramp[STEPS[distance]], `white/${name}-${STEPS[distance]}`])
        pairs.push([CANVAS, ramp[STEPS[distance]], `canvas/${name}-${STEPS[distance]}`])
      }
      for (const [a, b, where] of pairs) {
        const ratio = contrast(a, b)
        if (ratio < worst.ratio) worst = { ratio, where }
      }
    }
  }
  return worst
}

// ---------------------------------------------------------------------------
// Type, space, radius, elevation, motion
// ---------------------------------------------------------------------------

/** 12 / 13 / 14 / 16 / 20 / 28 / 36 px. Name → [size, line height]. */
export const TYPE_SCALE = {
  caption: ['0.75rem', '1rem'],
  small: ['0.8125rem', '1.125rem'],
  body: ['0.875rem', '1.25rem'],
  lead: ['1rem', '1.5rem'],
  title: ['1.25rem', '1.75rem'],
  headline: ['1.75rem', '2.125rem'],
  display: ['2.25rem', '2.5rem'],
} as const

export const FONTS = {
  sans: "'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif",
  display: "'PT Sans Narrow', 'Arial Narrow', ui-sans-serif, sans-serif",
} as const

/** Spacing steps a layout may use (4 px grid; 2 px only for hairlines). */
export const SPACING_STEPS = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20] as const

export const RADII = { sm: '0.25rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem' } as const

/** Fewer shadows: a hairline lift at rest, a soft one for overlays. */
export const SHADOWS = {
  card: '0 1px 2px 0 rgb(40 34 26 / 0.04)',
  pop: '0 10px 28px -8px rgb(24 20 14 / 0.18), 0 3px 8px -4px rgb(24 20 14 / 0.10)',
} as const

/** Motion (IBM Carbon): productive for task work, expressive for rare moments. */
export const MOTION = {
  durations: {
    'fast-01': '70ms',
    'fast-02': '110ms',
    'moderate-01': '150ms',
    'moderate-02': '240ms',
    'slow-01': '400ms',
  },
  easings: {
    'productive-standard': 'cubic-bezier(0.2, 0, 0.38, 0.9)',
    'productive-entrance': 'cubic-bezier(0, 0, 0.38, 0.9)',
    'productive-exit': 'cubic-bezier(0.2, 0, 1, 0.9)',
    'expressive-standard': 'cubic-bezier(0.4, 0.14, 0.3, 1)',
    'expressive-entrance': 'cubic-bezier(0, 0, 0.3, 1)',
    'expressive-exit': 'cubic-bezier(0.4, 0.14, 1, 1)',
  },
} as const

// ---------------------------------------------------------------------------
// Role names the components use (shadcn/ui vocabulary), pointing into the
// ramps. One place to re-map, and the contrast test resolves them too.
// ---------------------------------------------------------------------------

export function roleTokens(): Record<string, string> {
  const r = RAMPS
  return {
    background: '#ffffff',
    foreground: r.slate[900],
    card: '#ffffff',
    'card-foreground': r.slate[900],
    popover: '#ffffff',
    'popover-foreground': r.slate[900],
    primary: r.navy[600],
    'primary-foreground': '#ffffff',
    secondary: r.slate[100],
    'secondary-foreground': r.slate[900],
    muted: r.slate[100],
    'muted-foreground': r.slate[600],
    accent: r.slate[100],
    'accent-foreground': r.slate[900],
    destructive: r.danger[600],
    'destructive-foreground': '#ffffff',
    border: r.slate[200],
    input: r.slate[300],
    ring: r.sky[400],
    link: r.sky[600],
    // the sidebar: navy dimmed one step (800), its text quiet
    sidebar: r.navy[800],
    'sidebar-foreground': r.slate[50],
    'sidebar-muted': r.navy[200],
    'sidebar-accent': r.navy[700],
  }
}

/** Every colour token (`--color-<name>`) as hex. */
export function colorTokens(): Record<string, string> {
  const out: Record<string, string> = { white: '#ffffff', black: '#000000', canvas: CANVAS, scrim: RAMPS.navy[900] }
  for (const [name, ramp] of Object.entries(RAMPS)) for (const step of STEPS) out[`${name}-${step}`] = ramp[step]
  for (const [k, c] of Object.entries(STATUS_COLORS)) {
    const key = k.replace('_', '-')
    out[`status-${key}-tint`] = c.tint
    out[`status-${key}-line`] = c.line
    out[`status-${key}`] = c.solid
    out[`status-${key}-ink`] = c.ink
    out[`status-${key}-deep`] = c.deep
  }
  for (const [k, c] of Object.entries(AGING_COLORS)) {
    const key = `aging-${k.replace('+', 'plus').replace('-', 'to')}`
    out[`${key}-tint`] = c.tint
    out[`${key}-line`] = c.line
    out[key] = c.solid
    out[`${key}-ink`] = c.ink
    out[`${key}-deep`] = c.deep
  }
  CATEGORICAL.forEach((hex, i) => (out[`data-${i + 1}`] = hex))
  SEQUENTIAL.forEach((hex, i) => (out[`seq-${i + 1}`] = hex))
  Object.assign(out, roleTokens())
  return out
}

// ---------------------------------------------------------------------------
// The generated @theme
// ---------------------------------------------------------------------------

export function renderTokensCss(): string {
  const tokens = colorTokens()
  const lines: string[] = [
    '/* GENERATED by src/design/palette.ts — do not edit; run `npm run design:tokens`. */',
    '/* Values in sRGB hex; the OKLCH each was solved from is in the comment. */',
    '@theme {',
    "  /* Tailwind's own palettes are not part of this system. */",
    '  --color-*: initial;',
    '  --color-transparent: transparent;',
    '  --color-current: currentColor;',
  ]
  for (const [name, hex] of Object.entries(tokens)) {
    lines.push(`  --color-${name}: ${hex};${/^#[0-9a-f]{6}$/.test(hex) ? ` /* ${cssOklch(hexToOklch(hex))} */` : ''}`)
  }
  lines.push('')
  lines.push(`  --font-sans: ${FONTS.sans};`)
  lines.push(`  --font-display: ${FONTS.display};`)
  for (const [name, [size, lineHeight]] of Object.entries(TYPE_SCALE)) {
    lines.push(`  --text-${name}: ${size};`)
    lines.push(`  --text-${name}--line-height: ${lineHeight};`)
  }
  lines.push('')
  for (const [name, value] of Object.entries(RADII)) lines.push(`  --radius-${name}: ${value};`)
  for (const [name, value] of Object.entries(SHADOWS)) lines.push(`  --shadow-${name}: ${value};`)
  lines.push('')
  for (const [name, value] of Object.entries(MOTION.durations)) lines.push(`  --duration-${name}: ${value};`)
  for (const [name, value] of Object.entries(MOTION.easings)) lines.push(`  --ease-${name}: ${value};`)
  lines.push('  /* Every `transition-*` utility is productive by default. */')
  lines.push(`  --default-transition-duration: ${MOTION.durations['fast-02']};`)
  lines.push(`  --default-transition-timing-function: ${MOTION.easings['productive-standard']};`)
  lines.push('}')
  return `${lines.join('\n')}\n`
}

export { contrast, luminance }
