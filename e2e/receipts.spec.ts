/**
 * Phase 2 / step 3 — receipts, end to end on the offline mock (which applies
 * create_premium_receipt's rules): the register on the search bar, recording
 * a receipt with allocations (auto-allocate oldest first), the cross-currency
 * preview with the rate both ways and the inverted-rate warning, a receipt's
 * panel (remove, allocate the rest), export = what is shown, and who may do
 * what.
 */
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import { installMock } from './support/mockSupabase'
import { TABLES } from './support/fixtures'
import { convert, inverseRate } from '../src/features/premium/receipts'

const rows = (page: Page) => page.locator('main tbody tr')
const bar = (page: Page) => page.locator('header').getByRole('combobox')
const idOf = (insured: string) => String(TABLES.submissions.find((s) => s.insured_name === insured)!.id)

async function openRegister(page: Page, role: 'finance' | 'management' | 'admin' = 'finance', lang: 'en' | 'ru' | 'uz' = 'en') {
  await installMock(page.context(), role, lang)
  await page.goto('/receipts')
  await rows(page).first().waitFor()
}

test('the register: seeded receipts, its own search words', async ({ page }) => {
  await openRegister(page)
  await expect(rows(page)).toHaveCount(2)
  await expect(bar(page)).toHaveAttribute('placeholder', 'Search or filter: payer, bank reference, currency…')
  await bar(page).fill('MT103 TRB')
  await page.keyboard.press('Enter')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('RCP-2026-0001')
  await bar(page).fill('payer:meridian')
  await page.keyboard.press('Enter')
  await expect(rows(page)).toHaveCount(1)
  await expect(page.locator('main [data-chip]').first()).toContainText('Payer: Meridian Risk Partners')
  await bar(page).fill('unallocated')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Nothing matches this search')).toBeVisible()
})

test('record a receipt: auto-allocate oldest first, all in one go', async ({ page }) => {
  await openRegister(page)
  await page.getByRole('button', { name: 'New receipt' }).click()
  const dlg = page.getByRole('dialog', { name: 'New receipt' })
  await expect(dlg.getByText('Fill in the payer, currency and amount to allocate the receipt.')).toBeVisible()
  await dlg.getByLabel('Payer').selectOption({ label: 'Tashkent Re Brokers' })
  await dlg.getByLabel('Amount, USD').fill('10000')
  await dlg.getByLabel('Bank reference').fill('SWIFT MT103 TRB-60001')
  await dlg.getByRole('button', { name: 'Auto-allocate oldest first' }).click()
  const allocRows = dlg.locator('[data-allocation-row]')
  expect(await allocRows.count()).toBeGreaterThan(0)
  await expect(dlg.locator('[data-allocation-total]')).toContainText('Fully allocated')
  // oldest due first: due dates never go back down the list
  const dues = await allocRows.evaluateAll((els) => els.map((el) => el.textContent?.match(/Due date: (\d{2} \w{3} \d{4})/)?.[1] ?? ''))
  expect(dues.map((d) => Date.parse(d))).toEqual([...dues.map((d) => Date.parse(d))].sort((a, b) => a - b))
  await dlg.getByRole('button', { name: /Record receipt and \d+ allocations?/ }).click()
  await expect(dlg).toHaveCount(0)
  await expect(page.getByText('RCP-2026-0003 recorded')).toBeVisible()
  await expect(rows(page)).toHaveCount(3)
  const newRow = rows(page).filter({ hasText: 'RCP-2026-0003' })
  await expect(newRow).toContainText('10,000.00')
  await expect(newRow).toContainText('Fully allocated')

  // the Premium tab of the paid submission links back to the receipt
  await page.goto(`/submissions/${idOf('Tashkent City Mall')}`)
  await page.getByRole('link', { name: 'RCP-2026-0003' }).first().click()
  await expect(page).toHaveURL(/\/receipts\?q=RCP-2026-0003$/)
  await expect(rows(page)).toHaveCount(1)
})

test('across currencies: live preview, the rate both ways, an inverted rate is flagged', async ({ page }) => {
  await openRegister(page)
  await page.getByRole('button', { name: 'New receipt' }).click()
  const dlg = page.getByRole('dialog', { name: 'New receipt' })
  await dlg.getByLabel('Payer').selectOption({ label: 'Meridian Risk Partners' })
  await dlg.getByLabel('Amount, USD').fill('5000')
  await dlg.getByRole('button', { name: /SUB-.*#2/ }).first().click()
  const row = dlg.locator('[data-allocation-row]').first()
  const amount = row.getByLabel('Amount, USD')
  const rate = row.getByLabel('Rate: EUR per 1 USD')
  // the stored rate on the received date is filled in
  const stored = await rate.inputValue()
  expect(Number(stored)).toBeGreaterThan(0)
  await amount.fill('3000')
  const preview = row.locator('[data-fx-preview]')
  await expect(preview).toContainText(`3,000.00 USD`)
  await expect(preview).toContainText(`${Number(convert('3000', stored)).toLocaleString('en-US', { minimumFractionDigits: 2 })} EUR`)
  await expect(preview).toContainText(`1 USD = ${stored} EUR`)
  await expect(preview).toContainText(`1 EUR = ${inverseRate(stored)} USD`)
  await expect(preview.getByRole('alert')).toHaveCount(0)

  // the commonest slip: USD per EUR instead of EUR per USD
  await rate.fill(inverseRate(stored)!)
  await expect(preview.getByRole('alert')).toContainText('This looks inverted')
  await row.getByRole('button', { name: 'Use stored' }).click()
  await expect(rate).toHaveValue(stored)
  await expect(preview.getByRole('alert')).toHaveCount(0)

  // more than is outstanding cannot be saved
  await amount.fill('999999')
  await expect(row).toContainText('More than is outstanding')
  await expect(dlg.getByRole('button', { name: /Record receipt/ })).toBeDisabled()
  await row.getByRole('button', { name: 'Max' }).click()
  await expect(dlg.getByRole('button', { name: /Record receipt and 1 allocation/ })).toBeEnabled()
  await dlg.getByRole('button', { name: /Record receipt and 1 allocation/ }).click()
  await expect(page.getByText(/RCP-2026-0003 recorded/)).toBeVisible()
})

test('a receipt’s panel: remove an allocation, then allocate the rest', async ({ page }) => {
  await openRegister(page)
  await rows(page).filter({ hasText: 'RCP-2026-0001' }).click()
  const panel = page.getByRole('dialog', { name: 'RCP-2026-0001' })
  await expect(panel.locator('tbody tr')).toHaveCount(2)
  page.once('dialog', (d) => void d.accept())
  await panel.getByRole('button', { name: 'Remove allocation' }).last().click()
  await expect(panel.locator('tbody tr')).toHaveCount(1)
  await panel.getByRole('button', { name: /Allocate the remaining 5,000.00 USD/ }).click()
  await panel.getByRole('button', { name: 'Auto-allocate oldest first' }).click()
  await expect(panel.locator('[data-allocation-total]')).toContainText('Fully allocated')
  await panel.getByRole('button', { name: /Save \d+ allocations?/ }).click()
  await expect(page.getByText('RCP-2026-0001: allocations saved')).toBeVisible()
  await expect(panel.locator('tbody tr')).toHaveCount(2)
})

test('export contains exactly the receipts shown', async ({ page }) => {
  await openRegister(page)
  await bar(page).fill('ccy:USD, received>=2026-01-01')
  await page.keyboard.press('Enter')
  const shown = await rows(page).count()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export to Excel' }).click()])
  const zip = unzipSync(new Uint8Array(readFileSync((await download.path())!)))
  expect((strFromU8(zip['xl/worksheets/sheet1.xml']).match(/<row /g) ?? []).length - 1).toBe(shown)
})

test('who may do what: management reads, underwriters have no receipts page', async ({ page }) => {
  await openRegister(page, 'management')
  await expect(page.getByRole('button', { name: 'New receipt' })).toHaveCount(0)
  await rows(page).first().click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Remove allocation' })).toHaveCount(0)
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto('/receipts')
  await expect(page.locator('aside').getByRole('link', { name: 'Receipts' })).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText('RCP-2026')
})

test('Russian and Uzbek', async ({ page }) => {
  await openRegister(page, 'finance', 'ru')
  await expect(page.locator('main h1')).toHaveText('Поступления')
  await bar(page).fill('валюта:usd, плательщик:meridian')
  await page.keyboard.press('Enter')
  await expect(rows(page)).toHaveCount(1)
  await page.getByRole('button', { name: 'Новое поступление' }).click()
  await expect(page.getByRole('dialog', { name: 'Новое поступление' })).toBeVisible()
  await openRegister(page, 'finance', 'uz')
  await expect(page.locator('main h1')).toHaveText('Tushumlar')
})
