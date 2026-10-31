/**
 * Typed numbers (src/lib/decimal.ts parseDecimalInput): in Russian a comma is
 * the decimal separator and spaces group thousands; on blur the field shows
 * the number as it was read, and the form saves a plain decimal string.
 */
import { expect, test } from '@playwright/test'
import { installMock } from './support/mockSupabase'

const shown = (v: string) => v.replace(/[  ]/g, ' ')

test('RU: «1,5» is 1.5 %, «1 234 567,89» is shown back read and saved exactly', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'ru')
  await page.goto('/submissions/new')
  await page.locator('#insured_name').waitFor()

  const share = page.locator('#written_share_pct')
  await share.fill('1,5')
  await share.blur()
  await expect(share).toHaveValue('1,5')
  await expect(page.locator('#written_share_pct[aria-invalid="true"]')).toHaveCount(0)

  const gross = page.locator('#gross_premium_100')
  await gross.fill('1 234 567,89')
  await gross.blur()
  expect(shown(await gross.inputValue())).toBe('1 234 567,89')

  // pasted English style is read too and shown back the Russian way
  const sum = page.locator('#sum_insured_100')
  await sum.fill('1,234,567.89')
  await sum.blur()
  expect(shown(await sum.inputValue())).toBe('1 234 567,89')

  // live figures: our gross premium = 1.5 % of 1 234 567,89 = 18 518,52
  await expect(page.locator('main')).toContainText(/18\s518,52/)

  // garbage keeps today's validation error
  const limit = page.locator('#limit_100')
  await limit.fill('12abc')
  await limit.blur()
  await expect(limit).toHaveValue('12abc')
  await expect(page.locator('#limit_100[aria-invalid="true"]')).toHaveCount(1)
  await limit.fill('')
  await limit.blur()

  await page.locator('#insured_name').fill('Decimal Comma LLC')
  await page.locator('#mga_id').selectOption({ index: 1 })
  await page.locator('#source_party_id').selectOption({ index: 1 })

  const insert = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/rest/v1/submissions')
  await page.getByRole('button', { name: 'Создать заявку' }).click()
  const body = (await insert).postDataJSON() as Record<string, unknown>
  const row = (Array.isArray(body) ? body[0] : body) as Record<string, unknown>
  expect(row.written_share_pct).toBe('1.5')
  expect(row.gross_premium_100).toBe('1234567.89')
  expect(row.sum_insured_100).toBe('1234567.89')
})

test('EN: a single comma before three digits groups thousands in an amount, never in a percentage', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto('/submissions/new')
  const gross = page.locator('#gross_premium_100')
  await gross.waitFor()
  await gross.fill('1 234,5')
  await gross.blur()
  await expect(gross).toHaveValue('1,234.5')
  const commission = page.locator('#commission_pct')
  await commission.fill('12,5')
  await commission.blur()
  await expect(commission).toHaveValue('12.5')
})
