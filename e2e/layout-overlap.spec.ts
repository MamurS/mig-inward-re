/**
 * No text ever lies on top of other text: every page with lists, in EN / RU /
 * UZ, normal and large text, with and without Demo mode (the longest refs:
 * DEMO-SUB-…, DEMO-RCP-…). Each line of text is measured where it is actually
 * painted (clipped by its scrolling / truncating boxes); two lines of
 * different elements must not intersect, no text may be cut off without an
 * ellipsis (or a scroll box), and refs stay on one line.
 */
import { expect, test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import type { FixtureRole } from './support/fixtures'

type Hit = { a: string; b: string }
/** the demo claim's id number in the mock seed (after the four real claims and their movements) */
const DEMO_CLAIM_SEQ = 17

/** Text boxes that overlap another element's text (charts excluded: their labels are drawn, not laid out). */
function overlaps(page: Page) {
  return page.evaluate(() => {
    type Box = { x1: number; y1: number; x2: number; y2: number; el: Element; text: string }
    const boxes: Box[] = []
    const cut: string[] = []
    const clip = (el: Element, r: { x1: number; y1: number; x2: number; y2: number }, text: string) => {
      let out = { ...r }
      for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p)
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          const c = p.getBoundingClientRect()
          const next = { x1: Math.max(out.x1, c.left), y1: Math.max(out.y1, c.top), x2: Math.min(out.x2, c.right), y2: Math.min(out.y2, c.bottom) }
          // cut off by a box that neither scrolls nor ends in an ellipsis: text is lost silently
          const scrolls = /auto|scroll/.test(cs.overflowX + cs.overflowY)
          if (!scrolls && cs.textOverflow !== 'ellipsis' && next.x2 - next.x1 > 0 && next.x2 < out.x2 - 1) cut.push(text.slice(0, 40))
          out = next
        }
      }
      return out
    }
    const walker = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent?.trim()
      const el = n.parentElement
      if (!text || !el || el.closest('svg, .recharts-wrapper, [aria-hidden="true"], .sr-only')) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue
      const range = document.createRange()
      range.selectNodeContents(n)
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue
        // the glyph band: line boxes of neighbouring lines may touch, glyphs must not
        const pad = r.height * 0.2
        const b = clip(el, { x1: r.left, y1: r.top + pad, x2: r.right, y2: r.bottom - pad }, text)
        if (b.x2 - b.x1 > 1 && b.y2 - b.y1 > 1) boxes.push({ ...b, el, text })
      }
    }
    const hits: { a: string; b: string }[] = []
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const p = boxes[i]
        const q = boxes[j]
        if (p.el === q.el) continue
        const w = Math.min(p.x2, q.x2) - Math.max(p.x1, q.x1)
        const h = Math.min(p.y2, q.y2) - Math.max(p.y1, q.y1)
        if (w > 1 && h > 1) hits.push({ a: p.text.slice(0, 40), b: q.text.slice(0, 40) })
      }
    // refs stay on one line
    const broken = [...document.querySelectorAll('main [data-ref]')].filter((e) => {
      const r = document.createRange()
      r.selectNodeContents(e)
      return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1
    }).map((e) => e.textContent ?? '')
    return { hits, broken, cut: [...new Set(cut)] }
  })
}

const PAGES: { name: string; path: string; role: FixtureRole; ready: string }[] = [
  { name: 'dashboard', path: '/dashboard', role: 'management', ready: '[data-premium-dashboard]' },
  { name: 'register', path: '/submissions', role: 'underwriter', ready: 'main tbody tr' },
  { name: 'receivables', path: '/receivables', role: 'finance', ready: 'main h1' },
  { name: 'receipts', path: '/receipts', role: 'finance', ready: 'main h1' },
  { name: 'agenda', path: '/agenda', role: 'finance', ready: 'main h1' },
  { name: 'counterparty', path: '/counterparties/20000000-0000-4000-8000-000000000001', role: 'finance', ready: '[data-counterparty-premium] dl' },
  { name: 'claims', path: '/claims', role: 'claims', ready: 'main tbody tr' },
  { name: 'claim', path: '/claims/80000000-0000-4000-8000-000000000001', role: 'claims', ready: '[data-claim-header]' },
  { name: 'claims dashboard', path: '/dashboard', role: 'claims', ready: '[data-claims-dashboard] [data-ratio-table]' },
  { name: 'binders', path: '/binders', role: 'underwriter', ready: 'main tbody tr' },
  { name: 'binder', path: '/binders/b1000000-0000-4000-8000-000000000001', role: 'underwriter', ready: '[data-periods-grid]' },
  { name: 'binders dashboard', path: '/dashboard', role: 'management', ready: '[data-binders-dashboard] h2' },
]

for (const demoMode of [false, true]) {
  for (const lang of ['en', 'ru', 'uz'] as const) {
    for (const textSize of ['normal', 'large'] as const) {
      test(`no overlapping text · ${demoMode ? 'demo' : 'real'} · ${lang} · ${textSize}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
        const problems: string[] = []
        for (const p of PAGES) {
          // the demo world has no counterparty with that id; use the demo MGA there
          const path = demoMode && p.name === 'counterparty' ? '/counterparties/20000000-0000-4000-8000-000000000007'
            : demoMode && p.name === 'binder' ? '/binders/b1000000-0000-4000-8000-000000000003'
            : demoMode && p.name === 'claim' ? `/claims/80000000-0000-4000-8000-${String(DEMO_CLAIM_SEQ).padStart(12, '0')}` : p.path
          await installMock(context, p.role, lang, { textSize, demoMode })
          const page = await context.newPage()
          await page.goto(path)
          await page.locator(p.ready).first().waitFor()
          await page.waitForLoadState('networkidle')
          await page.evaluate(() => document.fonts.ready)
          const { hits, broken, cut } = await overlaps(page)
          problems.push(
            ...hits.map((h: Hit) => `${p.name}: «${h.a}» over «${h.b}»`),
            ...broken.map((b) => `${p.name}: ref broken over lines «${b}»`),
            ...cut.map((c) => `${p.name}: «${c}» cut off`),
          )
          await page.close()
        }
        expect(problems).toEqual([])
        await context.close()
      })
    }
  }
}

// «Needs attention» and the dashboard's other compact lists: the name on line 1 (the ref never takes its room), «ref · …» under it
for (const width of [1280, 1440]) {
  for (const lang of ['en', 'ru', 'uz'] as const) {
    for (const textSize of ['normal', 'large'] as const) {
      test(`compact lists: name on line 1, «ref · …» on line 2, nothing overlaps · ${width} · ${lang} · ${textSize}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width, height: 900 } })
        await installMock(context, 'management', lang, { textSize, demoMode: true })
        const page = await context.newPage()
        await page.goto('/dashboard')
        await page.locator('[data-premium-dashboard]').waitFor()
        await page.locator('[data-ref-list] [data-ref]').first().waitFor()
        await page.waitForLoadState('networkidle')
        await page.evaluate(() => document.fonts.ready)
        const rows = await page.locator('[data-ref-list] > li').evaluateAll((lis) =>
          lis.map((li) => {
            const row = li.querySelector('a')!.getBoundingClientRect()
            const ref = li.querySelector('[data-ref]')!.getBoundingClientRect()
            const name = li.querySelector('a > span:first-child > span:first-child')!.getBoundingClientRect()
            return { text: li.textContent ?? '', refBelowName: ref.top >= name.bottom - 1, nameFromLeft: name.left - row.left, refFromLeft: ref.left - row.left }
          }),
        )
        expect(rows.length).toBeGreaterThanOrEqual(3)
        for (const r of rows) {
          expect(r.refBelowName, r.text).toBe(true)
          // the name starts at the row's padding, not after a ref column
          expect(r.nameFromLeft, r.text).toBeLessThan(32)
          expect(Math.abs(r.refFromLeft - r.nameFromLeft), r.text).toBeLessThan(2)
        }
        const { hits, broken, cut } = await overlaps(page)
        expect([...hits.map((h) => `«${h.a}» over «${h.b}»`), ...broken, ...cut]).toEqual([])
        await context.close()
      })
    }
  }
}

test('the overlap check catches a ref drawn into the name (the old fixed-width bug)', async ({ page }) => {
  await installMock(page.context(), 'management', 'en', { demoMode: true })
  await page.goto('/dashboard')
  await page.locator('[data-ref-list] [data-ref]').first().waitFor()
  // put the old layout back: a 128 px ref cell that does not clip
  await page.addStyleTag({ content: '[data-ref-list] { display: block !important } [data-ref-list] a { display: flex !important } [data-ref] { width: 64px; flex: none; overflow: visible }' })
  const { hits } = await overlaps(page)
  expect(hits.length).toBeGreaterThan(0)
})

for (const lang of ['en', 'ru', 'uz'] as const) {
  for (const textSize of ['normal', 'large'] as const) {
    test(`«Facultative / Binder» stays on one line at 1280 px · ${lang} · ${textSize}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      await installMock(context, 'underwriter', lang, { textSize })
      const page = await context.newPage()
      await page.goto('/submissions/new')
      const toggle = page.locator('#business_type')
      await toggle.waitFor()
      await page.evaluate(() => document.fonts.ready)
      const tops = await toggle.getByRole('radio').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
      expect(tops).toHaveLength(2)
      expect(new Set(tops).size).toBe(1)
      await context.close()
    })
  }
}
