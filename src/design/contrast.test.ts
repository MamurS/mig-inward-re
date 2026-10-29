/**
 * The contrast guard (docs/design-research-2026-10.md, «Accessibility and
 * quality guardrails»): every text and icon colour pair the screens use
 * reaches WCAG 4.5 : 1 for normal text and 3 : 1 for large text and icons.
 *
 * Two layers:
 *   1. the palette — the pairing rule holds for every ramp and the canvas,
 *      and every status / ageing colour reads (ink on its tint and on white,
 *      the solid on white);
 *   2. the code — every `text-…` / `fill-…` / `stroke-…` colour class in a
 *      class list (any string literal of src that reads as one) is paired
 *      with the background of the same list; without one, with white AND the
 *      canvas, or — for a light colour — with the dark surface it sits on
 *      (the navy sidebar, the login panel, a primary button). Alpha is
 *      blended. A class list with a size (`size-*`, `h-*`), the display face
 *      or a title size is an icon / large text; anything else is text.
 * A failing pair names the file, the classes and the ratio.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { contrast, luminance } from './oklch'
import { AGING_COLORS, CANVAS, GRAPHIC_MIN, RAMPS, STATUS_COLORS, TEXT_MIN, colorTokens, worstContrastAt } from './palette'

const SRC = join(__dirname, '..')
const TOKENS = colorTokens()

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** `fg` at `alpha` over the opaque `bg`. */
function blend(fg: string, alpha: number, bg: string): string {
  const a = hexToRgb(fg)
  const b = hexToRgb(bg)
  return `#${a.map((x, i) => Math.round(x * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`
}

/** A colour class value (`slate-500`, `white/70`) → [hex, alpha]. */
function resolve(value: string): [string, number] | null {
  const [name, opacity] = value.split('/')
  const hex = TOKENS[name]
  if (!hex || !hex.startsWith('#')) return null
  return [hex, opacity ? Number(opacity) / 100 : 1]
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !path.includes(join('src', 'design')) ? [path] : []
  })
}

/** Every string literal of a file that reads as a class list, `${…}` holes cut out. */
function classStrings(source: string): string[] {
  const out: string[] = []
  for (const m of source.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)) {
    for (const part of (m[1] ?? m[2] ?? m[3]).split(/\$\{[^}]*\}/)) {
      if (/(^|\s)(?:[^\s:]+:)*(text|bg|fill|stroke)-[a-z]/.test(part)) out.push(part)
    }
  }
  return out
}

/** The dark surface a light colour with no background of its own sits on. */
function darkSurface(file: string): string {
  if (/(layout[\\/]AppLayout|LoginPage)\.tsx$/.test(file)) return TOKENS.sidebar
  return TOKENS.primary
}

interface Finding {
  file: string
  classes: string
  pair: string
  ratio: number
  need: number
}

const VARIANT = /^(?:\[[^\]]*\]:|[a-z0-9@*_-]+(?:\[[^\]]*\])?:)*/
/** States WCAG exempts (disabled controls) or hints checked elsewhere (placeholders). */
const EXEMPT_VARIANTS = /(^|:)(disabled|placeholder|group-disabled|aria-disabled):/

function audit(): Finding[] {
  const findings: Finding[] = []
  for (const file of files(SRC)) {
    const source = readFileSync(file, 'utf8')
    for (const raw of classStrings(source)) {
      const tokens = raw.split(/\s+/).filter(Boolean)
      const bgOf = (prefix: string): [string, number] | undefined =>
        tokens
          .map((t) => {
            const at = t.lastIndexOf('bg-')
            if (at < 0 || t.slice(0, at) !== prefix) return null
            return resolve(t.slice(at + 3))
          })
          .filter((v): v is [string, number] => v !== null)
          .at(-1)
      const graphic =
        tokens.some((t) => /^(size|h)-\d/.test(t) && !t.startsWith('h-px')) ||
        tokens.some((t) => /^font-display/.test(t)) ||
        tokens.some((t) => /^text-(title|headline|display)$/.test(t))
      for (const token of tokens) {
        if (EXEMPT_VARIANTS.test(token)) continue
        const base = token.replace(VARIANT, '')
        const prefix = token.slice(0, token.length - base.length)
        const own = bgOf(prefix.startsWith('[') ? prefix : '') ?? bgOf('')
        const m = /^(text|fill|stroke)-([a-z0-9-]+(?:\/\d+)?)$/.exec(base)
        if (!m) continue
        const color = resolve(m[2])
        if (!color) continue
        const need = graphic || m[1] !== 'text' ? GRAPHIC_MIN : TEXT_MIN
        const onDark = luminance(color[0]) > 0.4
        const ownHex = own ? (own[1] < 1 ? blend(own[0], own[1], onDark ? darkSurface(file) : TOKENS.white) : own[0]) : null
        const surfaces = ownHex ? [ownHex] : onDark ? [darkSurface(file)] : [TOKENS.white, TOKENS.canvas]
        for (const surface of surfaces) {
          const fg = color[1] < 1 ? blend(color[0], color[1], surface) : color[0]
          const ratio = contrast(fg, surface)
          if (ratio + 1e-9 < need) {
            findings.push({ file: relative(SRC, file), classes: raw.trim(), pair: `${m[0]} on ${surface}`, ratio, need })
          }
        }
      }
    }
  }
  return findings
}

describe('the palette keeps the pairing rule', () => {
  it('steps 5 apart read as text, 4 apart as icons and large text', () => {
    expect(worstContrastAt(5).ratio).toBeGreaterThanOrEqual(TEXT_MIN)
    expect(worstContrastAt(4).ratio).toBeGreaterThanOrEqual(GRAPHIC_MIN)
  })

  it('every status and ageing colour reads: ink and deep on the tint and on white, the solid on white', () => {
    for (const c of [...Object.values(STATUS_COLORS), ...Object.values(AGING_COLORS)]) {
      expect(contrast(c.ink, c.tint)).toBeGreaterThanOrEqual(TEXT_MIN)
      expect(contrast(c.deep, c.tint)).toBeGreaterThanOrEqual(TEXT_MIN)
      expect(contrast(c.ink, '#ffffff')).toBeGreaterThanOrEqual(TEXT_MIN)
      expect(contrast(c.solid, '#ffffff')).toBeGreaterThanOrEqual(GRAPHIC_MIN)
    }
  })

  it('secondary text reads on the canvas; white reads on the 90+ solid and the sidebar', () => {
    expect(contrast(RAMPS.slate[500], CANVAS)).toBeGreaterThanOrEqual(TEXT_MIN)
    expect(contrast(TOKENS['muted-foreground'], CANVAS)).toBeGreaterThanOrEqual(TEXT_MIN)
    expect(contrast('#ffffff', AGING_COLORS['90+'].ink)).toBeGreaterThanOrEqual(TEXT_MIN)
    expect(contrast(TOKENS['sidebar-foreground'], TOKENS.sidebar)).toBeGreaterThanOrEqual(TEXT_MIN)
    expect(contrast(TOKENS['sidebar-muted'], TOKENS.sidebar)).toBeGreaterThanOrEqual(TEXT_MIN)
    expect(contrast(TOKENS.ring, '#ffffff')).toBeGreaterThanOrEqual(GRAPHIC_MIN)
    expect(contrast(TOKENS.link, '#ffffff')).toBeGreaterThanOrEqual(TEXT_MIN)
  })
})

describe('every text and icon colour in use passes', () => {
  it('has no pair below 4.5 : 1 (text) or 3 : 1 (icons, large text)', () => {
    const findings = audit()
    expect(findings.map((f) => `${f.file}: ${f.pair} = ${f.ratio.toFixed(2)} < ${f.need} — "${f.classes}"`)).toEqual([])
  })
})
