/**
 * Phase 3 — claims, end to end on the offline mock (which applies the
 * database's rules): the register and its search words, a new claim with the
 * live coverage check, a claim's money (reserve movements, a payment by offset
 * against premium, status rules), the Claims tab, the dashboard section with
 * both loss ratios labelled, roles, demo isolation, RU / UZ.
 */
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import { installMock } from './support/mockSupabase'
import { SEEN, TABLES } from './support/fixtures'

const rows = (page: Page) => page.locator('main tbody tr')
const bar = (page: Page) => page.locator('header').getByRole('combobox')
const search = async (page: Page, q: string) => {
  await bar(page).fill(q)
  await page.keyboard.press('Enter')
  await page.waitForLoadState('networkidle')
}
const subId = (insured: string) => String(TABLES.submissions.find((s) => s.insured_name === insured)!.id)

async function register(page: Page, role: 'claims' | 'finance' | 'management' | 'underwriter' | 'admin' = 'claims', lang: 'en' | 'ru' | 'uz' = 'en', demoMode = false) {
  await installMock(page.context(), role, lang, { demoMode })
  await page.goto('/claims')
  await rows(page).first().waitFor()
}

test('the register: real claims only, its search words, export = shown', async ({ page }) => {
  await register(page)
  await expect(page.locator('main h1')).toHaveText('Claims')
  await expect(rows(page)).toHaveCount(5)
  await expect(page.locator('main tbody')).not.toContainText('DEMO')
  await search(page, 'large')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Emirates Aviation Services Hull')
  await expect(rows(page).first()).toContainText('Large loss')
  await search(page, 'status:closed')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Tashkent City Mall')
  await search(page, 'cashcall')
  await expect(rows(page)).toHaveCount(1)
  await search(page, 'fire')
  await expect(rows(page)).toHaveCount(1)
  await search(page, 'outstanding>10k')
  await expect(rows(page)).toHaveCount(2)
  const shown = await rows(page).count()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export to Excel' }).click()])
  const zip = unzipSync(new Uint8Array(readFileSync((await download.path())!)))
  expect((strFromU8(zip['xl/worksheets/sheet1.xml']).match(/<row /g) ?? []).length - 1).toBe(shown)
})

test('new claim: pick the bound risk, coverage checked live, a failed check needs a comment', async ({ page }) => {
  await register(page)
  await page.getByRole('button', { name: 'New claim' }).click()
  const dlg = page.getByRole('dialog', { name: 'New claim' })
  await dlg.getByLabel('Risk').fill('Kazakh')
  await dlg.locator('[data-risk-results] button').first().click()
  await expect(dlg.locator('[data-chosen-risk]')).toContainText('Kazakh Telecom Cyber Programme')
  // a loss long before inception: warned, comment required
  await dlg.getByLabel('Date of loss').fill('2024-01-15')
  await expect(dlg.locator('[data-coverage] [role="alert"]')).toContainText('The loss is before inception')
  await expect(dlg.getByRole('button', { name: 'Create claim' })).toBeDisabled()
  await dlg.getByLabel('Why the claim goes ahead anyway').fill('Held covered by the MGA')
  await expect(dlg.getByRole('button', { name: 'Create claim' })).toBeEnabled()
  // a loss inside the period: fine
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  await dlg.getByLabel('Date of loss').fill(yesterday)
  await expect(dlg.locator('[data-coverage]')).toContainText('Cover checks out')
  await dlg.getByLabel(/Estimate \(100 %\)/).fill('2000000')
  await expect(dlg).toContainText('Our share: 150,000.00 USD')
  await dlg.getByLabel('Cause / peril').fill('Ransomware')
  await dlg.getByRole('button', { name: 'Create claim' }).click()
  await expect(page).toHaveURL(/\/claims\/[0-9a-f-]+$/)
  await expect(page.locator('main h1')).toHaveText('Kazakh Telecom Cyber Programme')
  await expect(page.locator('[data-claim-header]')).toContainText('Notified')
  await expect(page.getByText(/Claim CLM-\d{4}-\d{4} created/)).toBeVisible()
})

test('a claim: reserve movements, status rules, large-loss and cash-call marks', async ({ page }) => {
  await register(page)
  await search(page, 'large')
  await rows(page).first().click()
  const header = page.locator('[data-claim-header]')
  await expect(header).toContainText('Large loss')
  await expect(header).toContainText(/Cash call due/)
  await expect(header).toContainText('25,000.00') // 60k reserved − 35k cash call
  await page.getByRole('button', { name: 'Reserve movement' }).click()
  const dlg = page.getByRole('dialog', { name: 'Reserve movement' })
  await dlg.getByRole('radio', { name: 'Decrease' }).click()
  await dlg.getByLabel('Amount, USD').fill('5000')
  await expect(dlg).toContainText('Outstanding after: 20,000.00 USD')
  await dlg.getByLabel('Reason').fill('Repair quote revised')
  await dlg.getByRole('button', { name: 'Save movement' }).click()
  await expect(page.getByText('Reserve movement saved')).toBeVisible()
  await expect(header).toContainText('20,000.00')
  // closing with money outstanding needs a comment
  await page.getByRole('button', { name: 'Close the claim' }).click()
  const close = page.getByRole('dialog', { name: 'Close the claim' })
  await expect(close).toContainText('Outstanding is 20,000.00 USD')
  await expect(close.getByRole('button', { name: 'Close the claim' })).toBeDisabled()
  await close.getByLabel('Closing comment').fill('Remaining reserve released on settlement')
  await close.getByRole('button', { name: 'Close the claim' }).click()
  await expect(header).toContainText('Closed')
  await expect(page.getByRole('button', { name: 'Reopen the claim' })).toBeVisible()
})

test('finance pays by offset against the MGA’s premium; the receipt appears in Receipts', async ({ page }) => {
  await register(page, 'finance')
  await search(page, 'fire')
  await rows(page).first().click()
  await expect(page.getByRole('button', { name: 'Reserve movement' })).toHaveCount(0) // claims role only
  await page.getByRole('button', { name: 'Record payment' }).click()
  const dlg = page.getByRole('dialog', { name: 'Record payment' })
  await dlg.getByRole('radio', { name: 'Offset against premium' }).click()
  await dlg.getByLabel('Amount, USD').first().fill('1000')
  await dlg.getByRole('button', { name: 'Auto-allocate oldest first' }).click()
  await dlg.getByRole('button', { name: 'Save payment' }).click()
  await expect(page.getByText('Payment saved')).toBeVisible()
  const offset = page.getByRole('link', { name: /^RCP-\d{4}-\d{4}$/ })
  await expect(offset).toBeVisible()
  await offset.click()
  await expect(page).toHaveURL(/\/receipts\?q=RCP-/)
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('1,000.00')
})

test('the risk’s Claims tab and the counterparty card', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto(`/submissions/${subId('Navoiyazot Chemical Plant')}`)
  await page.getByRole('tab', { name: 'Claims' }).click()
  const tab = page.locator('[data-claims-tab]')
  await expect(tab).toContainText(/CLM-\d{4}-\d{4}/)
  await expect(tab).toContainText('7,000.00') // outstanding: 18k reserved − 11k paid
  await expect(tab.getByRole('button', { name: 'New claim' })).toHaveCount(0) // underwriters read only
  await page.goto('/counterparties/20000000-0000-4000-8000-000000000001')
  const card = page.locator('[data-counterparty-claims]')
  await expect(card).toContainText('Open claims')
  await expect(card.locator('[data-loss-ratio]')).toContainText('Loss ratio, incurred / written')
  await expect(card.locator('[data-loss-ratio]')).toContainText('Loss ratio, incurred / earned')
})

test('dashboard: claims figures open the register; loss ratios labelled both ways', async ({ page }) => {
  await installMock(page.context(), 'management', 'en')
  await page.goto('/dashboard')
  const section = page.locator('[data-claims-dashboard]')
  await section.waitFor()
  const open = section.locator('[data-slot="card"]').filter({ hasText: 'Open claims' }).first()
  await expect(open.locator('.text-display')).toHaveText('4')
  // large losses and cash calls are in «Needs attention», above the claims section
  const attention = page.locator('[data-attention]')
  await expect(attention.locator('[data-large-losses]')).toContainText('Emirates Aviation Services Hull')
  await expect(attention.locator('[data-cash-calls]')).toContainText('Emirates Aviation Services Hull')
  // loss ratios: every MGA's full name above its bars, none cut on an axis
  await section.locator('[data-loss-ratios] .recharts-yAxis-tick-labels text').first().waitFor()
  const names = await section.locator('[data-loss-ratios] .recharts-yAxis-tick-labels text').allTextContents()
  expect(names.length).toBeGreaterThan(1)
  for (const n of names) expect(n).not.toContain('…')
  expect(names).toContain('Silk Road Underwriting Agency')
  const table = section.locator('[data-ratio-table]')
  await expect(table).toContainText('Loss ratio, incurred / written')
  await expect(table).toContainText('Loss ratio, incurred / earned')
  await section.getByRole('radio', { name: 'Underwriting year' }).click()
  await expect(table.locator('thead')).toContainText('Underwriting year')
  await open.click()
  await expect(page).toHaveURL(/\/claims\?q=status/)
  await expect(rows(page)).toHaveCount(4)
})

test('who may do what; demo claims only in Demo mode; Russian and Uzbek', async ({ page }) => {
  await register(page, 'management')
  await expect(page.getByRole('button', { name: 'New claim' })).toHaveCount(0)
  await register(page, 'underwriter')
  await expect(page.getByRole('button', { name: 'New claim' })).toHaveCount(0)
  await register(page, 'claims', 'en', true)
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('DEMO-CLM-')
  await register(page, 'claims', 'ru')
  await expect(page.locator('main h1')).toHaveText('Убытки')
  await search(page, 'крупный')
  await expect(rows(page)).toHaveCount(1)
  await register(page, 'claims', 'uz')
  await expect(page.locator('main h1')).toHaveText('Zararlar')
  expect(SEEN.submissions.length).toBeGreaterThan(0)
})
