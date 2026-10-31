/**
 * Phase C — binders and bordereaux, end to end on the offline mock (which
 * applies the database's import rules): the register and its search words,
 * a binder's page (terms, capacity, the periods grid), a new binder, the
 * upload wizard for risk (mapping, checks, comments, duplicates, the capacity
 * alert), premium (totals against the MGA's, the installment) and claims
 * (matched by the cedent's reference, never duplicated), the dashboard
 * section, the submission form's binder link, roles, demo isolation, RU / UZ.
 */
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import { installMock } from './support/mockSupabase'
import { BINDER_LIVE } from './support/binders'

const rows = (page: Page) => page.locator('main tbody tr')
const bar = (page: Page) => page.locator('header').getByRole('combobox')
const search = async (page: Page, q: string) => {
  await bar(page).fill(q)
  await page.keyboard.press('Enter')
  await page.waitForLoadState('networkidle')
}
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

async function open(page: Page, path: string, role: 'admin' | 'underwriter' | 'finance' | 'claims' | 'management' = 'admin', lang: 'en' | 'ru' | 'uz' = 'en', demoMode = false) {
  await installMock(page.context(), role, lang, { demoMode })
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

/** A CSV file for the wizard's file input. */
const csv = (name: string, lines: (string | number)[][]) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(lines.map((l) => l.join(';')).join('\n')) })

/** Warnings need a comment each before the import. */
async function commentWarnings(w: ReturnType<Page['locator']>, text = 'Accepted per the MGA') {
  await w.getByRole('button', { name: 'All lines' }).click()
  const warned = w.locator('[data-review-table] tr[data-status="warning"]')
  for (let i = 0; i < (await warned.count()); i++) await warned.nth(i).getByRole('textbox').fill(text)
}

async function startUpload(page: Page, kind: 'Risk' | 'Premium' | 'Claims', file: ReturnType<typeof csv>) {
  await page.getByRole('button', { name: 'Upload bordereau' }).click()
  const w = page.locator('[data-bordereau-wizard]')
  await w.getByLabel('Kind').selectOption({ label: kind })
  await w.locator('[data-bdx-file]').setInputFiles(file)
  await expect(w.locator('[data-file-summary]')).toBeVisible()
  await w.getByRole('button', { name: 'Next' }).click()
  await expect(w.locator('[data-mapping]')).toBeVisible()
  return w
}

test('the register: terms, capacity, bordereaux owed; search words; export = shown', async ({ page }) => {
  await open(page, '/binders')
  await expect(page.locator('main h1')).toHaveText('Binders')
  await expect(rows(page)).toHaveCount(2)
  await expect(page.locator('main tbody')).not.toContainText('DEMO')
  const live = rows(page).filter({ hasText: 'ALM-CARGO-2026' })
  await expect(live).toContainText('Caspian Specialty MGA')
  await expect(live).toContainText('85 %')
  await expect(live).toContainText('missing')
  await expect(live).toContainText('1 late')
  await search(page, 'missing')
  await expect(rows(page)).toHaveCount(1)
  await search(page, 'capacity>=80')
  await expect(rows(page)).toHaveCount(1)
  await search(page, 'status:draft')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('AKT-CARGO-2026')
  const shown = await rows(page).count()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export to Excel' }).click()])
  const zip = unzipSync(new Uint8Array(readFileSync((await download.path())!)))
  expect((strFromU8(zip['xl/worksheets/sheet1.xml']).match(/<row /g) ?? []).length - 1).toBe(shown)
})

test('a binder: terms, capacity alert, the periods grid (late, missing), its bordereau lines', async ({ page }) => {
  await open(page, `/binders/${BINDER_LIVE}`)
  const head = page.locator('[data-binder-header]')
  await expect(head).toContainText('Capacity 80 % used')
  await expect(head).toContainText('34,000,000.00')
  await expect(head).toContainText('20 %')
  await expect(page.locator('[data-binder-lob-list]')).toContainText('CARGO')
  const grid = page.locator('[data-periods-grid]')
  await expect(grid.locator('[data-state="late"]')).toHaveCount(1)
  expect(await grid.locator('[data-state="missing"]').count()).toBeGreaterThan(2)
  // the late bordereau's lines in a side panel
  await grid.locator('[data-state="late"] button').click()
  const panel = page.locator('[data-bordereau-panel]')
  await expect(panel.locator('[data-bordereau-lines] tbody tr')).toHaveCount(5)
  await page.keyboard.press('Escape')
  // follow-ups: the capacity alert for the underwriter
  await expect(page.getByText('Capacity 80 % used').last()).toBeVisible()
})

test('a new binder needs an MGA, a period, our share and a line of business', async ({ page }) => {
  await open(page, '/binders', 'underwriter')
  await page.getByRole('button', { name: 'New binder' }).click()
  const dlg = page.locator('[data-binder-dialog]')
  await dlg.getByRole('button', { name: 'Create binder' }).click()
  await expect(dlg).toContainText('Tick at least one line of business')
  await dlg.getByLabel('Binder ref.').fill('SRU-PROP-2027')
  await dlg.getByLabel('MGA').selectOption({ label: 'Silk Road Underwriting Agency' })
  await dlg.getByLabel('Inception').fill(day(10))
  await dlg.getByLabel('Expiry').fill(day(374))
  await dlg.getByLabel('Our share, %').fill('12.5')
  await dlg.getByLabel(/Aggregate limit/).fill('25 000 000')
  await dlg.locator('[data-binder-lobs] label').filter({ hasText: 'PROP' }).getByRole('checkbox').check()
  await dlg.locator('[data-territories]').getByRole('button', { name: 'UZ' }).click()
  await dlg.getByRole('button', { name: 'Create binder' }).click()
  await expect(page).toHaveURL(/\/binders\/[0-9a-f-]+$/)
  await expect(page.locator('main h1')).toHaveText('SRU-PROP-2027')
  await expect(page.locator('[data-binder-header]')).toContainText('12.5 %')
})

test('risk bordereau: columns mapped from the saved template, every line checked, comments, duplicates refused, capacity alert at 100 %', async ({ page }) => {
  await open(page, `/binders/${BINDER_LIVE}`)
  const w = await startUpload(page, 'Risk', csv('caspian_risk.csv', [
    ['Certificate No', 'Assured', 'Country', 'Inception', 'Currency', 'Limit 100%'],
    ['ALM-9-1', 'New shipment A', 'UZ', day(-20), 'USD', '3 000 000'],
    ['ALM-9-2', 'New shipment B', 'KZ', day(-15), 'USD', '3 500 000'],
    ['ALM-9-3', 'Shipment to Russia', 'RU', day(-15), 'USD', '1000'],
    ['ALM-9-4', 'Too big', 'UZ', day(-15), 'USD', '6000000'],
  ]))
  // the MGA's saved mapping filled the columns
  await expect(w.getByLabel('Policy / certificate')).toHaveValue('Certificate No')
  await expect(w.getByLabel('Limit 100 %', { exact: true })).toHaveValue('Limit 100%')
  await w.getByRole('button', { name: 'Check' }).click()
  const summary = w.locator('[data-review-summary]')
  await expect(summary).toContainText('2 errors')
  await expect(w.locator('[data-review-table]')).toContainText('Country RU is not in the binder’s territories')
  await expect(w.locator('[data-review-table]')).toContainText('Above the limit per risk')
  await w.getByRole('button', { name: 'All lines' }).click()
  await expect(w.locator('[data-review-table] tbody tr')).toHaveCount(4)
  // lines from another month are warnings: a comment each before importing
  const warned = w.locator('[data-review-table] tr[data-status="warning"]')
  const nWarn = await warned.count()
  if (nWarn > 0) {
    await expect(w.locator('[data-import]')).toBeDisabled()
    for (let i = 0; i < nWarn; i++) await warned.nth(i).getByRole('textbox').fill('Declared late by the MGA')
  }
  await expect(w.locator('[data-computed-total]')).toHaveText('6,500,000.00')
  await w.locator('[data-import]').click()
  await expect(w.locator('[data-import-result]')).toContainText(/BDX-\d{4}-\d{4} imported/)
  await expect(w.locator('[data-import-result]')).toContainText('2 lines imported')
  await expect(w.locator('[data-import-result]')).toContainText('2 lines with errors were left out')
  await w.getByRole('button', { name: 'Close' }).first().click()
  // 34m + 6.5m of 40m: capacity reached
  await expect(page.locator('[data-binder-header]')).toContainText('Aggregate reached')
  await expect(page.getByText('Capacity 100 % used').first()).toBeVisible()

  // the same lines again are refused as duplicates
  const w2 = await startUpload(page, 'Risk', csv('again.csv', [
    ['Certificate No', 'Assured', 'Country', 'Inception', 'Currency', 'Limit 100%'],
    ['ALM-9-1', 'New shipment A', 'UZ', day(-20), 'USD', '3000000'],
  ]))
  await w2.getByRole('button', { name: 'Check' }).click()
  await expect(w2.locator('[data-review-table]')).toContainText('Already imported with an earlier bordereau')
  await expect(w2.locator('[data-import]')).toBeDisabled()
})

test('premium bordereau (finance): totals against the MGA’s need a comment; one installment, our share, net of deductions', async ({ page }) => {
  await open(page, `/binders/${BINDER_LIVE}`, 'finance')
  const w = await startUpload(page, 'Premium', csv('caspian_premium.csv', [
    ['Certificate No', 'Assured', 'Inception', 'Currency', 'Gross Premium 100%'],
    ['ALM-1-1', 'Almalyk MMC shipment 1/1', day(-160), 'USD', '10 000,00'],
    ['ALM-1-2', 'Almalyk MMC shipment 1/2', day(-157), 'USD', '20 000,00'],
  ]))
  await w.getByRole('button', { name: 'Check' }).click()
  await expect(w.locator('[data-computed-total]')).toHaveText('30,000.00')
  await w.locator('[data-stated-total]').fill('31000')
  await expect(w.getByRole('alert')).toContainText('The MGA states 31,000.00, the lines add up to 30,000.00')
  await expect(w.locator('[data-import]')).toBeDisabled()
  await w.getByLabel('Why the totals differ').fill('MGA total includes a policy fee')
  await expect(w.locator('[data-import-effect]')).toContainText('our share (20 %)')
  await w.locator('[data-import]').click()
  await expect(w.locator('[data-import-result]')).toContainText('1 premium installment created')
  await w.getByRole('button', { name: 'Close' }).first().click()
  await page.getByRole('tab', { name: /Premium/ }).click()
  const prem = page.getByRole('tabpanel')
  await expect(prem).toContainText('6,000.00')
  await expect(prem).toContainText('4,350.00') // 6,000 − 27.5 % commission
})

test('claims bordereau (claims role): a claim per cedent reference, the reserve follows; never duplicated', async ({ page }) => {
  await open(page, `/binders/${BINDER_LIVE}`, 'claims')
  const file = (os: number, paid: number) => csv('caspian_claims.csv', [
    ['Claim No', 'Policy', 'Date of loss', 'Currency', 'Paid', 'Outstanding', 'Cause'],
    ['CSP-CL-500', 'ALM-1-1', day(-40), 'USD', paid, os, 'Overturned truck'],
  ])
  let w = await startUpload(page, 'Claims', file(500000, 0))
  await w.getByRole('button', { name: 'Check' }).click()
  await commentWarnings(w)
  await w.locator('[data-import]').click()
  await expect(w.locator('[data-import-result]')).toContainText('1 line imported')
  await w.getByRole('button', { name: 'Close' }).first().click()
  await page.getByRole('tab', { name: /Claims/ }).click()
  await expect(page.getByRole('tabpanel').locator('tbody tr')).toHaveCount(1)
  await expect(page.getByRole('tabpanel')).toContainText('CSP-CL-500')
  await expect(page.getByRole('tabpanel')).toContainText('100,000.00') // 20 % of 500,000

  // next month the MGA reports 300,000 paid + 300,000 outstanding: same claim, reserve to 120,000
  w = await startUpload(page, 'Claims', file(300000, 300000)) // the next period owed
  await w.getByRole('button', { name: 'Check' }).click()
  await commentWarnings(w)
  await w.locator('[data-import]').click()
  await expect(w.locator('[data-import-result]')).toBeVisible()
  await w.getByRole('button', { name: 'Close' }).first().click()
  await page.getByRole('tab', { name: /Claims/ }).click()
  await expect(page.getByRole('tabpanel').locator('tbody tr')).toHaveCount(1)
  await expect(page.getByRole('tabpanel')).toContainText('120,000.00')
})

test('dashboard: binders section opens the register; the submission form links a binder submission to its binder', async ({ page }) => {
  await open(page, '/dashboard', 'management')
  const sec = page.locator('[data-binders-dashboard]')
  await expect(sec).toContainText('Active binders')
  await expect(page.locator('[data-attention] [data-bordereaux-to-chase]')).toContainText('ALM-CARGO-2026')
  await expect(sec.locator('[data-capacity-alerts]')).toContainText('85 %')
  await sec.getByText('Capacity alerts').first().click()
  await expect(page).toHaveURL(/\/binders\?q=capacity/)
  await expect(rows(page)).toHaveCount(1)

  await open(page, '/submissions/new', 'underwriter')
  await expect(page.getByLabel('Binder', { exact: true })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'MGA', exact: true }).selectOption({ label: 'Caspian Specialty MGA' })
  await page.getByRole('radio', { name: 'Binder' }).click()
  const pick = page.getByLabel('Binder', { exact: true })
  await expect(pick.locator('option')).toHaveCount(3) // not linked + the two Caspian binders
  await pick.selectOption(BINDER_LIVE)
  await expect(pick.locator('option:checked')).toContainText('ALM-CARGO-2026')
})

test('who may do what; demo binders only in Demo mode; Russian and Uzbek', async ({ page }) => {
  // management reads, never uploads or edits
  await open(page, `/binders/${BINDER_LIVE}`, 'management')
  await expect(page.locator('[data-binder-header]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload bordereau' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)
  // demo mode: only the demo binder
  await open(page, '/binders', 'admin', 'en', true)
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('DEMO-IZM-PROP-2026')
  // RU / UZ
  await open(page, '/binders', 'admin', 'ru')
  await expect(page.locator('main h1')).toHaveText('Биндеры')
  await expect(rows(page).filter({ hasText: 'ALM-CARGO-2026' })).toContainText('с опозданием')
  await open(page, '/binders', 'admin', 'uz')
  await expect(page.locator('main h1')).toHaveText('Binderlar')
})
