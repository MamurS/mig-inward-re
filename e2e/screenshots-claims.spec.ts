/**
 * Claims, for the record: the register, a claim (large loss, cash call,
 * reserve history), the new-claim form with a coverage warning, the dashboard
 * section with loss ratios — EN in one theme each, RU and UZ register.
 * Run: SHOTS=docs/claims/screenshots npx playwright test screenshots-claims
 * Skipped unless SHOTS names an output folder.
 */
import { test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'

const OUT = process.env.SHOTS

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

test.describe('claims screenshots', () => {
  test.skip(!OUT, 'set SHOTS=<folder> to capture')

  test('register, claim, form, dashboard', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    await installMock(context, 'claims', 'en', { theme: 'blue' })
    const page = await context.newPage()
    await page.goto('/claims')
    await page.locator('main tbody tr').first().waitFor()
    await settle(page)
    await page.screenshot({ path: `${OUT}/01-register-en.png` })

    await page.goto('/claims/80000000-0000-4000-8000-000000000005')
    await page.locator('[data-claim-header]').waitFor()
    await settle(page)
    await page.screenshot({ path: `${OUT}/02-claim-large-loss-en.png`, fullPage: true })

    await page.goto('/claims')
    await page.getByRole('button', { name: 'New claim' }).click()
    const dlg = page.getByRole('dialog', { name: 'New claim' })
    await dlg.getByLabel('Risk').fill('Kazakh')
    await dlg.locator('[data-risk-results] button').first().click()
    await dlg.getByLabel('Date of loss').fill('2024-01-15')
    await dlg.locator('[data-coverage] [role="alert"]').waitFor()
    await settle(page)
    await page.screenshot({ path: `${OUT}/03-new-claim-coverage-warning-en.png` })
    await context.close()
  })

  test('dashboard', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    await installMock(context, 'management', 'en', { theme: 'green' })
    const page = await context.newPage()
    await page.goto('/dashboard')
    await page.locator('[data-claims-dashboard] [data-ratio-table]').waitFor()
    await settle(page)
    await page.locator('[data-claims-dashboard]').screenshot({ path: `${OUT}/04-dashboard-claims-en.png` })
    await context.close()
  })

  for (const lang of ['ru', 'uz'] as const) {
    test(`register ${lang}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
      await installMock(context, 'claims', lang, { theme: 'orange', textSize: 'large' })
      const page = await context.newPage()
      await page.goto('/claims')
      await page.locator('main tbody tr').first().waitFor()
      await settle(page)
      await page.screenshot({ path: `${OUT}/05-register-${lang}-large.png` })
      await context.close()
    })
  }
})
