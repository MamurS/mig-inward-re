/**
 * Demo data, end to end on the offline mock (which applies the restrictive
 * RLS policy is_demo = demo_mode()): real users with Demo mode off never see
 * a demo row — lists, search, dashboard totals; with Demo mode on (Appearance)
 * a DEMO banner runs across the top and only demo rows show; the admin's
 * Demo data tab loads, checks and deletes. The database side is checked by
 * supabase/tests/demo_isolation.sql.
 */
import { expect, test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import { TABLES, USERS } from './support/fixtures'

const rows = (page: Page) => page.locator('main tbody tr')
const bar = (page: Page) => page.locator('header').getByRole('combobox')
const real = TABLES.submissions.filter((s) => !s.is_demo)
const demo = TABLES.submissions.filter((s) => s.is_demo)
const awaiting = (list: typeof real) => list.filter((s) => s.status === 'offered' || s.status === 'no_response').length

async function switchDemo(page: Page, name: string) {
  await page.locator('header').getByRole('button', { name }).click()
  await page.getByRole('menuitem', { name: 'Appearance' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByRole('switch', { name: 'Demo mode' }).click()
  await page.keyboard.press('Escape')
}

test('demo mode off: no demo row in lists, search or counterparties', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto('/submissions')
  await rows(page).first().waitFor()
  await expect(rows(page)).toHaveCount(real.length)
  await expect(page.locator('main')).not.toContainText('DEMO')
  await expect(page.locator('[data-demo-banner]')).toHaveCount(0)
  await bar(page).fill('Izmir')
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toContainText('0 submissions')
  await expect(rows(page).filter({ hasText: 'Izmir' })).toHaveCount(0)
  await page.goto('/counterparties')
  await rows(page).first().waitFor()
  await expect(page.locator('main')).not.toContainText('DEMO')
})

test('dashboard totals exclude demo rows', async ({ page }) => {
  expect(awaiting(demo)).toBeGreaterThan(0)
  await installMock(page.context(), 'management', 'en')
  await page.goto('/dashboard')
  const tile = page.locator('main a, main [data-slot="card"]').filter({ hasText: 'Awaiting answer' }).first()
  await expect(tile).toContainText(String(awaiting(real)))
  await expect(page.locator('main')).not.toContainText('DEMO')
})

test('demo mode on: a DEMO banner, only demo rows; switching back hides them again', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto('/submissions')
  await rows(page).first().waitFor()
  await switchDemo(page, USERS.underwriter.full_name)
  const banner = page.locator('[data-demo-banner]')
  await expect(banner).toContainText('DEMO')
  await expect(banner).toContainText('You are looking at demo data only')
  await expect(rows(page)).toHaveCount(demo.length)
  for (const r of await rows(page).allTextContents()) expect(r).toContain('DEMO')
  await expect(rows(page).first()).toContainText('DEMO-SUB-')

  // the banner stays in view while the page scrolls, and leads back out
  await page.mouse.wheel(0, 2000)
  await expect(banner).toBeInViewport()
  await banner.getByRole('button', { name: 'Leave demo mode' }).click()
  await expect(banner).toHaveCount(0)
  await expect(rows(page)).toHaveCount(real.length)
  await expect(page.locator('main')).not.toContainText('DEMO')
})

test('a counterparty created in demo mode is demo data, named «DEMO …»', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto('/counterparties')
  await rows(page).first().waitFor()
  await switchDemo(page, USERS.underwriter.full_name)
  await expect(page.locator('[data-demo-banner]')).toBeVisible()
  await expect(page.locator('main')).toContainText('DEMO Anatolia MGA')
  await expect(page.locator('main')).not.toContainText('Silk Road Underwriting Agency')
})

test('admin: demo data tab — counts, check, delete; only admins', async ({ page }) => {
  await installMock(page.context(), 'admin', 'en')
  await page.goto('/admin?tab=demo')
  const counts = page.locator('[data-demo-counts]')
  await expect(counts).toContainText(`Submissions${demo.length}`)
  await expect(page.getByRole('button', { name: 'Load demo data' })).toBeDisabled()
  await page.getByRole('button', { name: 'Check links' }).click()
  await expect(page.getByRole('status')).toContainText('No links between demo and real data.')
  await page.getByRole('button', { name: 'Delete all demo data' }).click()
  const dlg = page.getByRole('dialog', { name: 'Delete all demo data?' })
  await expect(dlg).toContainText(`${demo.length} demo submissions`)
  await dlg.getByRole('button', { name: 'Delete demo data' }).click()
  await expect(page.getByText('All demo data deleted')).toBeVisible()
  await expect(counts).toContainText('Submissions0')
  await expect(page.getByRole('button', { name: 'Delete all demo data' })).toBeDisabled()
  await page.getByRole('button', { name: 'Load demo data' }).click()
  await expect(page.getByText('Demo data loaded')).toBeVisible()
  await expect(counts).toContainText(`Submissions${demo.length}`)
})

test('Russian and Uzbek: the banner and the switch', async ({ page }) => {
  await installMock(page.context(), 'finance', 'ru', { demoMode: true })
  await page.goto('/receipts')
  await expect(page.locator('[data-demo-banner]')).toContainText('Вы видите только демо-данные')
  await page.locator('header').getByRole('button', { name: USERS.finance.full_name }).click()
  await page.getByRole('menuitem', { name: 'Оформление' }).click()
  await expect(page.getByRole('switch', { name: 'Демо-режим' })).toHaveAttribute('aria-checked', 'true')
  await installMock(page.context(), 'finance', 'uz', { demoMode: true })
  await page.goto('/receipts')
  await expect(page.locator('[data-demo-banner]')).toContainText("Siz faqat demo ma'lumotlarni ko'ryapsiz")
})
