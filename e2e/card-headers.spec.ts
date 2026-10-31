/**
 * Dashboard card headers (attention lists, binder capacity): the title and the
 * compact «All →» link to the register share one line — a long title
 * («Самые старые предложения без ответа») truncates with a tooltip instead of
 * pushing the link under it. 1280 and 1440 px, EN / RU / UZ, both text sizes.
 */
import { expect, test } from '@playwright/test'
import { installMock } from './support/mockSupabase'

const ALL = { en: 'All — open in register', ru: 'Все — открыть в реестре', uz: 'Barchasi — reestrda ochish' } as const

for (const width of [1280, 1440]) {
  for (const lang of ['en', 'ru', 'uz'] as const) {
    for (const textSize of ['normal', 'large'] as const) {
      test(`card titles and «All →» share a line · ${width} px · ${lang} · ${textSize}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width, height: 900 } })
        await installMock(context, 'management', lang, { textSize })
        const page = await context.newPage()
        await page.goto('/dashboard')
        await page.locator('[data-binders-dashboard] h2').waitFor()
        await page.locator('[data-attention-card] [data-ref-list]').first().waitFor()
        await page.waitForLoadState('networkidle')
        await page.evaluate(() => document.fonts.ready)

        const headers = page.locator('[data-card-header]:has([data-register-link])')
        // dashboard (2), premium (1), claims (2), binders (2)
        expect(await headers.count()).toBeGreaterThanOrEqual(7)
        const boxes = await headers.evaluateAll((els) =>
          els.map((h) => {
            const title = h.querySelector('[data-slot="card-title"]') as HTMLElement
            const text = (title.querySelector('span[title]') ?? title) as HTMLElement
            const link = h.querySelector('[data-register-link]') as HTMLElement
            const tr = text.getBoundingClientRect()
            const lr = link.getBoundingClientRect()
            const line = parseFloat(getComputedStyle(text).lineHeight) || tr.height
            return { title: text.getAttribute('title') ?? text.innerText, titleTop: tr.top, linkTop: lr.top, titleHeight: tr.height, line, linkRight: lr.right, headerRight: h.getBoundingClientRect().right, label: link.getAttribute('aria-label'), tip: link.getAttribute('title') }
          }),
        )
        for (const b of boxes) {
          expect(Math.abs(b.titleTop - b.linkTop), `«${b.title}»: the link is on the title's line`).toBeLessThanOrEqual(6)
          expect(b.titleHeight, `«${b.title}» stays on one line`).toBeLessThan(b.line * 1.5)
          expect(b.linkRight).toBeLessThanOrEqual(b.headerRight + 1)
          expect(b.label).toBe(ALL[lang])
          expect(b.tip).toBeTruthy()
        }
        await context.close()
      })
    }
  }
}
