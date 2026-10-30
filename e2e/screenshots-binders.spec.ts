/**
 * Binders, for the record: the register, a binder (capacity, periods grid),
 * the upload wizard's check step, the dashboard section — EN in one theme
 * each, RU and UZ register in large text.
 * Run: SHOTS=docs/binders/screenshots npx playwright test screenshots-binders
 * Skipped unless SHOTS names an output folder.
 */
import { test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import { BINDER_LIVE } from './support/binders'

const OUT = process.env.SHOTS
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

test.describe('binders screenshots', () => {
  test.skip(!OUT, 'set SHOTS=<folder> to capture')

  test('register, binder, wizard', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    await installMock(context, 'admin', 'en', { theme: 'blue' })
    const page = await context.newPage()
    await page.goto('/binders')
    await page.locator('main tbody tr').first().waitFor()
    await settle(page)
    await page.screenshot({ path: `${OUT}/01-register-en.png` })

    await page.goto(`/binders/${BINDER_LIVE}`)
    await page.locator('[data-periods-grid]').waitFor()
    await settle(page)
    await page.screenshot({ path: `${OUT}/02-binder-en.png`, fullPage: true })

    await page.getByRole('button', { name: 'Upload bordereau' }).click()
    const w = page.locator('[data-bordereau-wizard]')
    const rows = [
      ['Certificate No', 'Assured', 'Country', 'Inception', 'Currency', 'Limit 100%'],
      ['ALM-9-1', 'Shipment A', 'UZ', day(-20), 'USD', '1 500 000'],
      ['ALM-9-2', 'Shipment B', 'KZ', day(-15), 'USD', '900000'],
      ['ALM-9-3', 'Shipment to Russia', 'RU', day(-15), 'USD', '1000'],
      ['ALM-9-4', 'Too big', 'UZ', day(-15), 'USD', '6000000'],
    ]
    await w.locator('[data-bdx-file]').setInputFiles({ name: 'caspian_risk.csv', mimeType: 'text/csv', buffer: Buffer.from(rows.map((r) => r.join(';')).join('\n')) })
    await w.locator('[data-file-summary]').waitFor()
    await w.getByRole('button', { name: 'Next' }).click()
    await w.locator('[data-mapping]').waitFor()
    await settle(page)
    await page.screenshot({ path: `${OUT}/03-wizard-mapping-en.png` })
    await w.getByRole('button', { name: 'Check' }).click()
    await w.locator('[data-review-summary]').waitFor()
    await w.getByRole('button', { name: 'All lines' }).click()
    await settle(page)
    await page.screenshot({ path: `${OUT}/04-wizard-check-en.png` })
    await context.close()
  })

  test('dashboard', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    await installMock(context, 'management', 'en', { theme: 'green' })
    const page = await context.newPage()
    await page.goto('/dashboard')
    await page.locator('[data-binders-dashboard] [data-capacity-alerts]').waitFor()
    await settle(page)
    await page.locator('[data-binders-dashboard]').screenshot({ path: `${OUT}/05-dashboard-binders-en.png` })
    await context.close()
  })

  for (const lang of ['ru', 'uz'] as const) {
    test(`register ${lang}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
      await installMock(context, 'underwriter', lang, { theme: 'orange', textSize: 'large' })
      const page = await context.newPage()
      await page.goto(`/binders/${BINDER_LIVE}`)
      await page.locator('[data-periods-grid]').waitFor()
      await settle(page)
      await page.screenshot({ path: `${OUT}/06-binder-${lang}-large.png` })
      await context.close()
    })
  }
})
