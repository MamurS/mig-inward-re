/**
 * The submissions register's default columns fit a 1280 px screen: the key
 * columns (status, shares, our premium) are seen without scrolling sideways,
 * in EN / RU / UZ, normal text, with real refs and the longest ones (Demo
 * mode: DEMO-SUB-…).
 */
import { expect, test } from '@playwright/test'
import { installMock } from './support/mockSupabase'

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
