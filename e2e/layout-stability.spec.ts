/**
 * Layout stability (docs/design-research-2026-10.md, guardrails): nothing on
 * screen moves unless the user moved it. On each key screen, in EN / RU / UZ,
 * the positions of the landmarks (header, sidebar, title, cards, table rows,
 * buttons) are recorded, then the page is hovered, keyboard-focused and a menu
 * is opened — every landmark must stay exactly where it was (± 0.5 px).
 * Loading must not shift the title either: its position on first paint equals
 * its position when the data has arrived.
 */
import { expect, test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import type { FixtureRole } from './support/fixtures'

const LANGS = ['en', 'ru', 'uz'] as const
const SCREENS: { name: string; path: string; role: FixtureRole; ready: string }[] = [
  { name: 'dashboard', path: '/dashboard', role: 'management', ready: 'main h1' },
  { name: 'register', path: '/submissions', role: 'underwriter', ready: 'main tbody tr' },
  { name: 'submission detail', path: '/submissions/30000000-0000-4000-8000-000000000002', role: 'underwriter', ready: 'main h1' },
  { name: 'submission form', path: '/submissions/30000000-0000-4000-8000-000000000014/edit', role: 'underwriter', ready: 'main form' },
  { name: 'agenda', path: '/agenda', role: 'underwriter', ready: 'main h1' },
  { name: 'counterparty', path: '/counterparties/20000000-0000-4000-8000-000000000001', role: 'underwriter', ready: 'main h1' },
  { name: 'tokens', path: '/admin/tokens', role: 'admin', ready: 'main h1' },
]

const LANDMARKS =
  'header, aside, main h1, main h2, main [data-slot="card"], main table, main tbody tr, main form, main button, main a, main [role="tab"]'

type Rect = { key: string; x: number; y: number; w: number; h: number }

async function snapshot(page: Page): Promise<Rect[]> {
  return page.evaluate((sel) => {
    const out: Rect[] = []
    // Sticky / fixed things (sidebar, top bar, table header) stay put on screen
    // when hover or focus scrolls the page: measure them against the viewport,
    // everything else against the document.
    const pinned = (el: Element | null): boolean => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const p = getComputedStyle(e).position
        if (p === 'fixed' || p === 'sticky') return true
      }
      return false
    }
    document.querySelectorAll(sel).forEach((el, i) => {
      const r = (el as HTMLElement).getBoundingClientRect()
      const [dx, dy] = pinned(el) ? [0, 0] : [window.scrollX, window.scrollY]
      out.push({ key: `${el.tagName.toLowerCase()}#${i}`, x: r.x + dx, y: r.y + dy, w: r.width, h: r.height })
    })
    return out
  }, LANDMARKS)
}

function moved(before: Rect[], after: Rect[]): string[] {
  const diffs: string[] = []
  const byKey = new Map(after.map((r) => [r.key, r]))
  for (const b of before) {
    const a = byKey.get(b.key)
    if (!a) continue
    if (Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5 || Math.abs(a.w - b.w) > 0.5 || Math.abs(a.h - b.h) > 0.5) {
      diffs.push(`${b.key}: (${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.w.toFixed(1)}×${b.h.toFixed(1)}) → (${a.x.toFixed(1)},${a.y.toFixed(1)} ${a.w.toFixed(1)}×${a.h.toFixed(1)})`)
    }
  }
  return diffs
}

for (const lang of LANGS) {
  for (const s of SCREENS) {
    test(`${s.name} stays still · ${lang}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await installMock(context, s.role, lang)
      const page = await context.newPage()
      await page.goto(s.path)

      // Loading: the title does not move between first paint and loaded data.
      const title = page.locator('main h1').first()
      await title.waitFor()
      const first = await title.boundingBox()
      await page.locator(s.ready).first().waitFor()
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(150)
      const loaded = await title.boundingBox()
      expect(Math.abs((loaded?.y ?? 0) - (first?.y ?? 0)), 'title moved while loading').toBeLessThanOrEqual(0.5)

      const base = await snapshot(page)

      // Hover: rows, buttons, links, tabs (first few of each). Each element is
      // scrolled into view first and the page measured afresh, so a sticky
      // block legitimately following the scroll is not counted as a shift.
      for (const sel of ['main tbody tr', 'main button', 'main a', 'main [role="tab"]', 'aside a']) {
        const items = page.locator(sel)
        const n = Math.min(await items.count(), 6)
        for (let i = 0; i < n; i++) {
          const el = items.nth(i)
          if (!(await el.isVisible()) || (await el.isDisabled())) continue
          await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
          await page.mouse.move(1, 899)
          await page.waitForTimeout(160)
          const before = await snapshot(page)
          const hovered = await el.hover({ timeout: 2000 }).then(() => true, () => false)
          if (!hovered) continue
          await page.waitForTimeout(160) // longer than the productive motion tokens
          expect(moved(before, await snapshot(page)), `hover ${sel}[${i}]`).toEqual([])
        }
      }

      // Keyboard focus: the focus ring is an outline, it never pushes anything.
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.mouse.move(1, 899)
      await page.waitForTimeout(160)
      for (let i = 0; i < 12; i++) {
        const y = await page.evaluate(() => window.scrollY)
        const before = await snapshot(page)
        await page.keyboard.press('Tab')
        await page.evaluate((top) => window.scrollTo(0, top), y)
        await page.waitForTimeout(160)
        expect(moved(before, await snapshot(page)), `keyboard focus ${i}`).toEqual([])
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(160)
      expect(moved(base, await snapshot(page)), 'back at the top').toEqual([])

      // A menu opened from the top bar must not shift the page (no scrollbar jump).
      await page.keyboard.press('Escape')
      const lang_ = page.getByRole('button', { name: /language|язык|til/i }).first()
      if (await lang_.isVisible()) {
        await lang_.click()
        await page.waitForTimeout(160)
        expect(moved(base, await snapshot(page)), 'menu open').toEqual([])
        await page.keyboard.press('Escape')
      }
      await context.close()
    })
  }
}
