/**
 * The register's total counts bound business only; offered / no response are
 * «pending», shown apart; NTU, declined, received and under review count in
 * neither (docs/totals-audit.md).
 */
import { expect, test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import { SEEN } from './support/fixtures'
import { registerTotals } from '../src/features/submissions/totals'

type Sub = { status: 'received' | 'under_review' | 'offered' | 'no_response' | 'bound' | 'declined' | 'ntu'; our_gross_premium_usd: number | null }
const subs = SEEN.submissions_v as unknown as Sub[]
const en = (v: number) => new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

/** The exact figure behind a compact amount (its tooltip), or the figure itself when small. */
async function exact(page: Page, which: 'bound' | 'pending') {
  const amount = page.locator(`[data-total-${which}] .num`).first()
  const text = (await amount.innerText()).trim()
  if ((await amount.getAttribute('tabindex')) === null) return text
  await amount.hover()
  const tip = page.getByRole('tooltip')
  await expect(tip).toBeVisible()
  const full = (await tip.innerText()).trim()
  await page.keyboard.press('Escape')
  await page.mouse.move(0, 0)
  await expect(tip).toBeHidden()
  return full
}

test('the total counts bound only; offered / no response are pending; NTU and declined nowhere', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto('/submissions')
  await page.locator('main tbody tr').first().waitFor()

  const expected = registerTotals(subs)
  // the fixtures hold every kind: otherwise the test would prove nothing
  expect(expected.boundCount).toBeGreaterThan(0)
  expect(expected.pendingCount).toBeGreaterThan(0)
  expect(subs.some((s) => s.status === 'ntu' && s.our_gross_premium_usd)).toBe(true)
  const everything = subs.reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0)
  expect(expected.boundUsd + expected.pendingUsd).toBeLessThan(everything)

  await expect(page.locator('[data-register-totals]')).toContainText('Total our gross (USD)')
  await expect(page.locator('[data-register-totals]')).toContainText('pending')
  expect(await exact(page, 'bound')).toBe(en(expected.boundUsd))
  expect(await exact(page, 'pending')).toBe(en(expected.pendingUsd))

  // the tooltip says what is counted where
  await page.locator('[data-register-totals] button').hover()
  await expect(page.getByRole('tooltip')).toContainText('bound business only')
})

test('NTU and declined rows add nothing to either figure', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto('/submissions?q=status%3Antu%7Cdeclined')
  await page.locator('main tbody tr').first().waitFor()
  await expect(page.locator('main tbody tr')).toHaveCount(subs.filter((s) => s.status === 'ntu' || s.status === 'declined').length)
  await expect(page.locator('[data-total-bound] .num')).toHaveText('0')
  await expect(page.locator('[data-total-pending] .num')).toHaveText('0')
})

test('pending rows alone: the total is 0 and the pending figure carries them', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto('/submissions?q=status%3Aoffered%7Cno_response')
  await page.locator('main tbody tr').first().waitFor()
  await expect(page.locator('[data-total-bound] .num')).toHaveText('0')
  const pending = registerTotals(subs.filter((s) => s.status === 'offered' || s.status === 'no_response'))
  expect(await exact(page, 'pending')).toBe(en(pending.pendingUsd))
})
