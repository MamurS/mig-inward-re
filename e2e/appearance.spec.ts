/**
 * Appearance (colour theme, text size), end to end on the offline mock:
 * - switching the theme changes colours only — no landmark moves by a pixel;
 * - the choice is saved and comes back on reload, applied before first paint;
 * - with Large text, in EN / RU / UZ, no key screen scrolls sideways, nav
 *   labels never overflow, and the Premium tab's row actions stay on screen.
 */
import { expect, test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import { TABLES, USERS, type FixtureRole } from './support/fixtures'

const LANDMARKS = 'header, aside, aside a, main h1, main [data-slot="card"], main table, main tbody tr, main button, main [role="tab"]'
type Rect = { key: string; x: number; y: number; w: number; h: number }

const rects = (page: Page) =>
  page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el, i) => {
    const r = el.getBoundingClientRect()
    return { key: `${el.tagName.toLowerCase()}#${i}`, x: r.x, y: r.y, w: r.width, h: r.height }
  }), LANDMARKS)

function moved(a: Rect[], b: Rect[]) {
  const byKey = new Map(b.map((r) => [r.key, r]))
  return a.filter((r) => {
    const o = byKey.get(r.key)
    return !o || Math.abs(o.x - r.x) > 0.5 || Math.abs(o.y - r.y) > 0.5 || Math.abs(o.w - r.w) > 0.5 || Math.abs(o.h - r.h) > 0.5
  }).map((r) => r.key)
}

const cssVar = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name)

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(250)
}

test('switching the theme changes colours, never geometry; the choice is saved', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await installMock(context, 'management', 'en')
  const page = await context.newPage()
  await page.goto('/dashboard')
  await page.locator('main h1').waitFor()
  await settle(page)
  const before = await rects(page)
  const greyPrimary = await cssVar(page, '--color-primary')

  await page.locator('header').getByRole('button', { name: USERS.management.full_name }).click()
  await page.getByRole('menuitem', { name: 'Appearance' }).click()
  const dlg = page.getByRole('dialog')
  for (const theme of ['Blue', 'Green', 'Orange', 'Grey']) {
    await dlg.getByRole('radio', { name: theme }).click()
    await expect(dlg.getByRole('radio', { name: theme })).toHaveAttribute('aria-checked', 'true')
    if (theme !== 'Grey') expect(await cssVar(page, '--color-primary')).not.toBe(greyPrimary)
  }
  await dlg.getByRole('radio', { name: 'Green' }).click()
  await page.keyboard.press('Escape')
  await expect(dlg).toHaveCount(0)
  await page.waitForTimeout(300) // past the 150 ms colour fade
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'green')
  expect(moved(before, await rects(page))).toEqual([])

  // Saved: a reload comes back green, and green from the first paint (inline script)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'green')
  await context.close()
})

test('text size: the frame (sidebar, top bar) does not move; Large paints large from the start', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await installMock(context, 'underwriter', 'en', { textSize: 'large' })
  const page = await context.newPage()
  await page.goto('/submissions')
  const title = page.locator('main h1')
  await title.waitFor()
  const first = await title.boundingBox()
  expect(await page.locator('html').getAttribute('data-text-size')).toBe('large')
  await page.locator('main tbody tr').first().waitFor()
  await settle(page)
  const loaded = await title.boundingBox()
  expect(Math.abs(first!.y - loaded!.y)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(first!.height - loaded!.height)).toBeLessThanOrEqual(0.5)
  const fontSize = await page.locator('main tbody td').first().evaluate((el) => getComputedStyle(el).fontSize)
  expect(fontSize).toBe('15px') // table 14 px + one step
  await context.close()
})

const SCREENS: { name: string; path: string; role: FixtureRole; ready: string }[] = [
  { name: 'dashboard', path: '/dashboard', role: 'management', ready: 'main h1' },
  { name: 'register', path: '/submissions', role: 'underwriter', ready: 'main tbody tr' },
  { name: 'submission detail', path: '/submissions/30000000-0000-4000-8000-000000000002', role: 'underwriter', ready: 'main h1' },
  { name: 'submission form', path: '/submissions/30000000-0000-4000-8000-000000000014/edit', role: 'underwriter', ready: 'main form' },
  { name: 'agenda', path: '/agenda', role: 'underwriter', ready: 'main h1' },
  { name: 'counterparty', path: '/counterparties/20000000-0000-4000-8000-000000000001', role: 'underwriter', ready: 'main h1' },
  { name: 'tokens', path: '/admin/tokens', role: 'admin', ready: 'main h1' },
  { name: 'receipts', path: '/receipts', role: 'finance', ready: 'main tbody tr' },
  { name: 'receivables', path: '/receivables', role: 'finance', ready: 'main tbody tr' },
  { name: 'claims', path: '/claims', role: 'claims', ready: 'main tbody tr' },
  { name: 'claim', path: '/claims/80000000-0000-4000-8000-000000000001', role: 'claims', ready: '[data-claim-header]' },
]

for (const lang of ['en', 'ru', 'uz'] as const) {
  for (const s of SCREENS) {
    test(`large text fits · ${s.name} · ${lang}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      await installMock(context, s.role, lang, { textSize: 'large', theme: 'orange' })
      const page = await context.newPage()
      await page.goto(s.path)
      await page.locator(s.ready).first().waitFor()
      await settle(page)
      const report = await page.evaluate(() => {
        const doc = document.documentElement
        const pageOverflow = doc.scrollWidth - doc.clientWidth
        // nav labels are never cut: they fit, or wrap to a second line
        const nav = [...document.querySelectorAll('aside a span')].filter((el) => {
          const e = el as HTMLElement
          return e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 || getComputedStyle(e).textOverflow === 'ellipsis'
        }).map((e) => e.textContent)
        // nothing in main sticks out past the viewport (scrolling boxes clip their own content)
        const sticking = [...document.querySelectorAll('main button, main a, main h1, main input, main select')].filter((el) => {
          const r = el.getBoundingClientRect()
          if (r.width === 0) return false
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX
            if (o === 'auto' || o === 'scroll' || o === 'hidden') return false
          }
          return r.right > window.innerWidth + 0.5
        }).map((e) => `${e.tagName} ${e.textContent?.slice(0, 30)}`)
        return { pageOverflow, nav, sticking }
      })
      expect(report.pageOverflow, 'page scrolls sideways').toBeLessThanOrEqual(0)
      expect(report.nav).toEqual([])
      expect(report.sticking).toEqual([])
      await context.close()
    })
  }

  test(`large text: Premium tab row actions stay visible · ${lang}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await installMock(context, 'finance', lang, { textSize: 'large' })
    const page = await context.newPage()
    await page.goto(`/submissions/${TABLES.submissions.find((x) => x.insured_name === 'Tashkent City Mall')!.id}`)
    const rows = page.locator('main tbody tr')
    await rows.first().waitFor()
    await settle(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    const buttons = page.locator('main tbody').getByRole('button')
    const n = await buttons.count()
    expect(n).toBeGreaterThan(0)
    for (let i = 0; i < n; i++) {
      const box = await buttons.nth(i).boundingBox()
      const scroller = await buttons.nth(i).evaluate((el) => el.closest('.overflow-x-auto')!.getBoundingClientRect().toJSON())
      expect(box!.x).toBeGreaterThanOrEqual(scroller.x - 0.5)
      expect(box!.x + box!.width).toBeLessThanOrEqual(scroller.x + scroller.width + 0.5)
    }
    await context.close()
  })
}
