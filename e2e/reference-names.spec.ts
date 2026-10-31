/**
 * Reference data in the UI language (lines of business, countries,
 * currencies), the English name as the fallback (src/lib/refName.ts): the
 * register, the submission page, the form's selects, the dashboard's group by
 * line of business, Admin › Reference data.
 */
import { expect, test } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import { SEEN } from './support/fixtures'

const firstSub = SEEN.submissions_v.find((s) => s.insured_name === 'Tashkent City Mall')!

for (const [lang, property, uzbekistan, usd] of [
  ['en', 'Property', 'Uzbekistan', 'US Dollar'],
  ['ru', 'Имущество', 'Узбекистан', 'Доллар США'],
  ['uz', 'Mulk', 'Oʻzbekiston', 'AQSH dollari'],
] as const) {
  test(`lines of business, countries and currencies in ${lang}`, async ({ page }) => {
    await installMock(page.context(), 'underwriter', lang)

    // the register's line-of-business column
    await page.goto('/submissions')
    const lobCells = page.locator('main tbody tr').filter({ hasText: 'Tashkent City Mall' }).first()
    await expect(lobCells).toContainText(property)
    if (lang !== 'en') await expect(page.locator('main tbody')).not.toContainText('Property')

    // the submission page: subtitle and the risk card
    await page.goto(`/submissions/${firstSub.id}`)
    await expect(page.locator('main')).toContainText(property)
    await expect(page.locator('main')).toContainText(uzbekistan)

    // the form's selects
    await page.goto('/submissions/new')
    await expect(page.locator('#lob_id option').filter({ hasText: property })).toHaveCount(1)
    await expect(page.locator('#currency option').filter({ hasText: `USD — ${usd}` })).toHaveCount(1)
  })
}

test('the dashboard groups bound premium by line of business in the UI language', async ({ page }) => {
  await installMock(page.context(), 'management', 'ru')
  await page.goto('/dashboard')
  await page.locator('[data-dash-charts]').waitFor()
  await page.locator('[data-dash-charts]').getByRole('tab', { name: 'Наша подтверждённая премия по видам (USD)' }).click()
  const ticks = page.locator('[data-dash-charts] [role="tabpanel"] .recharts-yAxis-tick-labels text')
  await ticks.first().waitFor()
  const names = await ticks.allTextContents()
  expect(names).toContain('Имущество')
  expect(names).not.toContain('Property')
})

test('Admin › Reference data: currencies have RU and UZ names like the others', async ({ page }) => {
  await installMock(page.context(), 'admin', 'en')
  await page.goto('/admin?tab=reference')
  await expect(page.getByRole('textbox', { name: 'RU · EUR' })).toHaveValue('Евро')
  await expect(page.getByRole('textbox', { name: 'UZ · UZS' })).toHaveValue('Oʻzbek soʻmi')
})
