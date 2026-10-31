/**
 * The receivables table is never cut off by its card: the default columns fit
 * 1440 px (normal text, EN / RU / UZ, real refs and the longest DEMO ones);
 * where they cannot (1280 px, large text) the table scrolls sideways inside the
 * card, says so with a soft right edge, and its last column comes fully into
 * view at the end of the scroll.
 */
import { expect, test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'

/** Where every cell ends relative to the scroll box, and whether the box sits inside its card. */
function measure(page: Page) {
  return page.locator('main [data-table-scroll]').evaluate((box) => {
    const b = box.getBoundingClientRect()
    const card = box.closest('[data-slot="card"]')!.getBoundingClientRect()
    const cells = [...box.querySelectorAll('th, td')].map((c) => c.getBoundingClientRect())
    return {
      inCard: b.left >= card.left - 0.5 && b.right <= card.right + 0.5,
      scrolls: box.scrollWidth > box.clientWidth + 1,
      overflowX: getComputedStyle(box).overflowX,
      clipped: cells.filter((c) => c.width > 0 && (c.right > b.right + 1 || c.left < b.left - 1)).length,
      moreX: Boolean(box.parentElement!.querySelector('[data-more-x]')),
    }
  })
}

for (const width of [1440, 1280]) {
  for (const lang of ['en', 'ru', 'uz'] as const) {
    for (const textSize of ['normal', 'large'] as const) {
      for (const demoMode of [false, true]) {
        test(`receivables: no cell clipped by the card · ${width} · ${lang} · ${textSize} · ${demoMode ? 'demo' : 'real'}`, async ({ browser }) => {
          const context = await browser.newContext({ viewport: { width, height: 900 } })
          await installMock(context, 'finance', lang, { textSize, demoMode })
          const page = await context.newPage()
          await page.goto('/receivables')
          await page.locator('main tbody tr').first().waitFor()
          await page.waitForLoadState('networkidle')
          await page.evaluate(() => document.fonts.ready)

          const m = await measure(page)
          expect(m.inCard).toBe(true)
          // the default column set fits a 1440 px screen at the normal text size
          if (width === 1440 && textSize === 'normal') expect(m.scrolls).toBe(false)
          if (!m.scrolls) {
            expect(m.clipped).toBe(0)
            expect(m.moreX).toBe(false)
            return
          }
          // otherwise: it scrolls inside the card, says so, and the last column comes fully into view
          expect(m.overflowX).toMatch(/auto|scroll/)
          expect(m.moreX).toBe(true)
          await page.locator('main [data-table-scroll]').evaluate((box) => box.scrollTo({ left: box.scrollWidth }))
          await expect(page.locator('main [data-more-x]')).toHaveCount(0)
          const last = await page.locator('main [data-table-scroll]').evaluate((box) => {
            const b = box.getBoundingClientRect()
            const th = [...box.querySelectorAll('thead th')].filter((x) => x.getBoundingClientRect().width > 0).at(-1)!.getBoundingClientRect()
            return th.right <= b.right + 1
          })
          expect(last).toBe(true)
          await context.close()
        })
      }
    }
  }
}
