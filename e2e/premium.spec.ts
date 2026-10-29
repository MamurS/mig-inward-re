/**
 * Phase 2 / step 2 — premium on the submission page, end to end on the offline
 * mock: the Premium tab, receivable vs payable (never netted), the schedule
 * editor (equal / custom, live preview, difference), the step after binding,
 * write-off with a reason and who did it, settling return premium.
 */
import { expect, test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import { TABLES } from './support/fixtures'
import type { FixtureRole } from './support/fixtures'

const idOf = (insured: string) => String(TABLES.submissions.find((s) => s.insured_name === insured)!.id)

async function open(page: Page, role: FixtureRole, insured: string) {
  await installMock(page.context(), role, 'en')
  await page.goto(`/submissions/${idOf(insured)}`)
  await page.getByRole('tab', { name: 'Premium' }).waitFor()
}

test('bound submission opens on Premium; return premium is payable, not netted', async ({ page }) => {
  await open(page, 'underwriter', 'Tashkent City Mall')
  await expect(page.getByRole('tab', { name: 'Premium' })).toHaveAttribute('data-state', 'active')
  const summary = page.locator('main dl').filter({ hasText: 'Payable to MGA' })
  // return premium: gross −2,000.00, commission −500.00, brokerage −100.00 → we owe 1,400.00
  await expect(summary.getByText('Payable to MGA').locator('..')).toContainText('1,400.00')
  const row = page.locator('main tbody tr').filter({ hasText: 'Return' })
  await expect(row).toContainText('To pay')
  await expect(row).toContainText('we owe the MGA')
  await expect(row).toContainText('1,400.00')
  // receivable excludes the return premium: it equals the sum of the receivable rows' «left to settle»
  const receivable = summary.getByText('Receivable (outstanding)').locator('..')
  await expect(receivable).not.toContainText('-')
  await expect(page.locator('main tbody tr').filter({ hasText: 'Partly paid' })).toHaveCount(1)
  await expect(page.getByText('RCP-2026-0001').first()).toBeVisible()
})

test('create a schedule: equal installments, live preview equals the expected premium', async ({ page }) => {
  await open(page, 'underwriter', 'Emirates Aviation Services Hull')
  await expect(page.getByText('No premium schedule yet')).toBeVisible()
  await page.getByRole('button', { name: 'Create premium schedule' }).click()
  const panel = page.getByRole('dialog')
  await panel.getByRole('radio', { name: 'Equal installments' }).click()
  await panel.getByLabel('Number of installments').fill('4')
  await panel.getByRole('radio', { name: 'quarter' }).click()
  await expect(panel.locator('tbody tr')).toHaveCount(4)
  await expect(panel.getByText('Differs')).toHaveCount(0) // equal split adds up exactly
  await panel.getByRole('button', { name: 'Create premium schedule' }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.locator('main tbody tr').filter({ hasText: 'Premium' })).toHaveCount(4)
  const summary = page.locator('main dl').filter({ hasText: 'Difference' })
  await expect(summary.getByText('Difference').locator('..')).toContainText('0.00')
})

test('custom schedule that differs from the expected premium is allowed but flagged', async ({ page }) => {
  await open(page, 'underwriter', 'Kazakh Telecom Cyber Programme')
  await page.getByRole('button', { name: 'Create premium schedule' }).click()
  const panel = page.getByRole('dialog')
  await panel.getByRole('radio', { name: 'Custom' }).click()
  await panel.getByLabel('Gross amount, USD').first().fill('1000')
  await expect(panel.getByText('Differs')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Create premium schedule' })).toBeEnabled()
})

test('binding opens the premium schedule step', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  const offered = TABLES.submissions.find((s) => s.status === 'offered')!
  await page.goto(`/submissions/${offered.id}`)
  await page.getByRole('button', { name: 'Mark bound' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByText('I confirm binding without a confirmation document').click()
  await dlg.getByRole('button', { name: 'Mark bound' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Create premium schedule' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tab', { name: 'Premium' })).toHaveAttribute('data-state', 'active')
  await expect(page.getByText('No premium schedule yet')).toBeVisible()
})

test('finance: write-off needs a reason and shows who and when; return premium can be settled', async ({ page }) => {
  await open(page, 'finance', 'Almalyk MMC Fleet Cargo Programme')
  const row = page.locator('main tbody tr').first()
  await expect(row.getByText(/d overdue/)).toBeVisible()
  await row.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Write off' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByRole('button', { name: 'Write off' })).toBeDisabled()
  await dlg.getByLabel('Reason').focus()
  await dlg.getByLabel('Reason').blur()
  await expect(dlg.getByText('Write why the installment is written off')).toBeVisible()
  await dlg.getByLabel('Reason').fill('MGA in liquidation; claim filed with administrator')
  await dlg.getByRole('button', { name: 'Write off' }).click()
  await expect(row).toContainText('Written off by Nodira Saidova')
  await expect(row).toContainText('MGA in liquidation')

  await page.goto(`/submissions/${idOf('Tashkent City Mall')}`)
  const ret = page.locator('main tbody tr').filter({ hasText: 'Return' })
  await ret.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Mark as paid to MGA' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Mark as paid to MGA' }).click()
  await expect(ret).toContainText('Settled')
  const summary = page.locator('main dl').filter({ hasText: 'Payable to MGA' })
  await expect(summary.getByText('Payable to MGA').locator('..')).toContainText('0.00')
})

test('underwriter cannot write off or settle; management sees no edit buttons', async ({ page }) => {
  await open(page, 'underwriter', 'Almalyk MMC Fleet Cargo Programme')
  await expect(page.locator('main tbody').getByRole('button', { name: 'Actions' })).toHaveCount(0)
  await page.context().close()
})

test('management: read-only premium tab', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await installMock(context, 'management', 'en')
  await page.goto(`/submissions/${idOf('Tashkent City Mall')}`)
  await page.getByRole('tab', { name: 'Premium' }).click()
  await expect(page.locator('main tbody tr').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add return premium' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Regenerate schedule' })).toHaveCount(0)
  await context.close()
})
