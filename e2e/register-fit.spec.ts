/**
 * The submissions register's default columns fit a 1280 px screen: the key
 * columns (status, shares, our premium) are seen without scrolling sideways,
 * in EN / RU / UZ, normal text, with real refs and the longest ones (Demo
 * mode: DEMO-SUB-…).
 */
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { installMock } from './support/mockSupabase'

/** Every seeded line's short names [EN, RU, UZ], as the migration writes them. */
const SEEDED_SHORT = [...readFileSync('supabase/migrations/20261031163621_lob_short_names.sql', 'utf8')
  .matchAll(/\('([A-Z]+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g)].map((m) => ({ code: m[1], en: m[2], ru: m[3], uz: m[4] }))

for (const demoMode of [false, true]) {
  for (const lang of ['en', 'ru', 'uz'] as const) {
    test(`the register fits 1280 px without scrolling sideways · ${demoMode ? 'demo' : 'real'} · ${lang}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      await installMock(context, 'underwriter', lang, { demoMode })
      const page = await context.newPage()
      await page.goto('/submissions')
      await page.locator('main tbody tr').first().waitFor()
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => document.fonts.ready)
      // the table's scroll box is its parent
      const box = await page.locator('main table').locator('xpath=..').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
      expect(box.scroll).toBeLessThanOrEqual(box.client + 1)
      await context.close()
    })
  }
}

test('the register shows the key columns by default; the others stay in «Columns»', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto('/submissions')
  await page.locator('main tbody tr').first().waitFor()
  const heads = (await page.locator('main thead th').allInnerTexts()).map((h) => h.trim()).filter((h) => h && h !== 'Actions')
  expect(heads).toEqual(['Ref. no.', 'Insured', 'Line of business', 'Status', 'Written / signed', 'Our gross (USD)', 'Received'])
  // the MGA is the grey line under the insured
  await expect(page.locator('main tbody tr').first().locator('td').nth(1).locator('span.text-muted-foreground')).not.toHaveText('')
  await page.getByRole('button', { name: 'Columns' }).click()
  for (const name of ['MGA', 'Broker', 'Underwriter', 'Period', 'Ccy']) {
    await expect(page.getByRole('menuitemcheckbox', { name, exact: true })).toHaveAttribute('aria-checked', 'false')
  }
})

// Lines of business show their short name (the full one in the tooltip): no
// seeded line is cut with an ellipsis in the register, at 1280 and 1440 px.
for (const width of [1280, 1440]) {
  for (const lang of ['en', 'ru', 'uz'] as const) {
    test(`no line of business is cut in the register · ${width} px · ${lang}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 900 } })
      await installMock(context, 'underwriter', lang)
      const page = await context.newPage()
      await page.goto('/submissions')
      await page.locator('main tbody tr').first().waitFor()
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => document.fonts.ready)
      const cells = await page.locator('main tbody td:has([data-lob-cell])').evaluateAll((tds) =>
        tds.map((td) => {
          const span = td.querySelector('[data-lob-cell]') as HTMLElement
          return { text: span.innerText.trim(), title: span.getAttribute('title'), scroll: td.scrollWidth, client: td.clientWidth, spanScroll: span.scrollHeight, spanClient: span.clientHeight, spanScrollW: span.scrollWidth, spanClientW: span.clientWidth, rowHeight: td.getBoundingClientRect().height }
        }),
      )
      expect(cells.length).toBeGreaterThan(5)
      for (const c of cells) {
        expect(c.text, `${c.text} fits its cell`).not.toContain('…')
        expect(c.scroll, `${c.text} fits its cell`).toBeLessThanOrEqual(c.client)
        // a long short name may take a second line, never a cut third one, and the row stays 48 px
        expect(c.spanScroll, `${c.text} is not clipped`).toBeLessThanOrEqual(c.spanClient)
        expect(c.spanScrollW, `${c.text} is not clipped`).toBeLessThanOrEqual(c.spanClientW)
        expect(c.rowHeight).toBeLessThanOrEqual(49)
        // the full name is the tooltip
        expect(c.title).toBeTruthy()
      }
      // every seeded line (the mock holds ten of the fifteen), put in a cell in turn:
      // it fits the cell and the register still fits the screen
      expect(SEEDED_SHORT).toHaveLength(15)
      for (const l of SEEDED_SHORT) {
        const fit = await page.locator('main tbody [data-lob-cell]').first().evaluate((span, name) => {
          span.textContent = name
          const td = span.closest('td')!
          const box = span.closest('table')!.parentElement!
          return { span: span.scrollWidth <= span.clientWidth && span.scrollHeight <= span.clientHeight, td: td.scrollWidth <= td.clientWidth, box: box.scrollWidth <= box.clientWidth + 1 }
        }, l[lang])
        expect(fit, `${l.code} «${l[lang]}»`).toEqual({ span: true, td: true, box: true })
      }
      await context.close()
    })
  }
}
