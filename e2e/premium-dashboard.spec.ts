/**
 * Phase 2 / step 5 — premium on the dashboard and the counterparty page:
 * the figures match the Receivables register they open, payable stays apart,
 * demo rows count only in Demo mode, finance sees the dashboard, and the
 * premium settings are in Admin › Settings.
 */
import { expect, test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'

const section = (page: Page) => page.locator('[data-premium-dashboard]')
const tile = (page: Page, label: string) => section(page).locator('[data-slot="card"]').filter({ hasText: label }).first()
/** The figure of a KPI tile (the big number). */
const figure = async (page: Page, label: string) => (await tile(page, label).locator('.text-display').textContent())!.trim()

test('dashboard premium figures open the register, and agree with it', async ({ page }) => {
  await installMock(page.context(), 'management', 'en')
  await page.goto('/dashboard')
  await section(page).waitFor()
  for (const label of ['Premium outstanding', 'Overdue premium', 'Received this month', `Received in ${new Date().getFullYear()}`, 'Payable to MGAs']) {
    await expect(tile(page, label)).toBeVisible()
  }
  const outstanding = await figure(page, 'Premium outstanding')
  const overdue = await figure(page, 'Overdue premium')
  const payable = await figure(page, 'Payable to MGAs')

  // outstanding → the register, whose own total tile shows the same figure
  await tile(page, 'Premium outstanding').click()
  await expect(page).toHaveURL(/\/receivables$/)
  await expect(page.locator('[data-ageing] [data-slot="card"]').filter({ hasText: 'Outstanding' }).first().locator('.text-display')).toHaveText(outstanding)

  // overdue → the register filtered to overdue, same total
  await page.goBack()
  await tile(page, 'Overdue premium').click()
  await expect(page).toHaveURL(/\/receivables\?q=overdue$/)
  await expect(page.locator('[data-ageing] [data-slot="card"]').filter({ hasText: 'Outstanding' }).first().locator('.text-display')).toHaveText(overdue)

  // payable stays apart: its own tile, its own list
  await page.goBack()
  await tile(page, 'Payable to MGAs').click()
  await expect(page).toHaveURL(/\/receivables\?q=payable$/)
  await expect(page.locator('main tbody tr')).toHaveCount(1)
  expect(payable).not.toBe('0')
})

test('top MGAs and the most overdue list open what they show', async ({ page }) => {
  await installMock(page.context(), 'finance', 'en')
  await page.goto('/dashboard')
  await expect(page.locator('aside').getByRole('link', { name: 'Dashboard' })).toBeVisible()
  const first = section(page).locator('[data-top-mgas] a').first()
  const name = (await first.locator('span[title]').first().getAttribute('title'))!
  await first.click()
  await expect(page).toHaveURL(/\/receivables\?q=mga/)
  await expect(page.locator('main [data-chip]').first()).toContainText(name)
  for (const t of await page.locator('main tbody tr td:nth-child(2) .text-muted-foreground').allTextContents()) expect(t).toBe(name)

  await page.goto('/dashboard')
  await section(page).locator('[data-most-overdue] li').first().waitFor()
  const days = await section(page).locator('[data-most-overdue] li').evaluateAll((els) => els.map((e) => Number(/(\d+)\s*d/.exec(e.textContent ?? '')?.[1] ?? 0)))
  expect(days.length).toBeGreaterThan(0)
  expect(days).toEqual([...days].sort((a, b) => b - a))
})

test('demo rows count only in Demo mode', async ({ browser }) => {
  for (const demoMode of [false, true]) {
    const context = await browser.newContext()
    await installMock(context, 'management', 'en', { demoMode })
    const page = await context.newPage()
    await page.goto('/dashboard')
    await section(page).locator('[data-most-overdue]').waitFor()
    const insured = await section(page).locator('[data-most-overdue] li').allTextContents()
    expect(insured.length).toBeGreaterThan(0)
    for (const t of insured) expect(t.includes('DEMO'), t).toBe(demoMode)
    await context.close()
  }
})

test('counterparty page: what this MGA owes, by age, and links filtered to them', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto('/counterparties/20000000-0000-4000-8000-000000000001')
  const card = page.locator('[data-counterparty-premium]')
  await expect(card).toContainText('Premium outstanding')
  await expect(card).toContainText('Payable to MGAs')
  await card.getByRole('link', { name: 'Open in Receivables' }).click()
  await expect(page).toHaveURL(/\/receivables\?q=mga%3A%22Silk\+Road\+Underwriting\+Agency%22$/)
})

test('admin settings: premium defaults (60 days terms, 0 days grace)', async ({ page }) => {
  await installMock(page.context(), 'admin', 'en')
  await page.goto('/admin?tab=settings')
  const premium = page.locator('[data-settings-group="premium"]')
  await expect(premium).toContainText('Premium')
  await expect(premium.getByLabel('Default payment terms (days after inception)')).toHaveValue('60')
  await expect(premium.getByLabel('Grace before the first overdue-premium follow-up (days)')).toHaveValue('0')
})
