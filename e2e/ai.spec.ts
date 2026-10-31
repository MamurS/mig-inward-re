/**
 * Phase D — AI-assisted data entry, end to end on the offline mock (a canned
 * reading, never a real model): fill a new submission from a slip — each
 * suggestion with its confidence and source, the MGA matched by name, a
 * broker that is not a counterparty, a doubtful premium left unticked, a bad
 * date refused, the duplicate warning — then the marked fields, nothing saved
 * until Save; the same file again comes from the cache; AI column mapping in
 * the bordereau wizard; Admin › AI (switch off, roles, the usage log); RU / UZ.
 */
import { expect, test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import { BINDER_LIVE } from './support/binders'

const SLIP = `REINSURANCE SLIP
Original Insured: JSC "Navoiyazot" Chemical Plant, Navoi, Uzbekistan
Coverholder: SILK ROAD UNDERWRITING AGENCY LLC
Period: 01.01.2027 – 31.12.2027 · TSI USD 180,000,000 · Line sought: 10%`

async function openForm(page: Page, role: 'underwriter' | 'admin' | 'management' = 'underwriter', lang: 'en' | 'ru' | 'uz' = 'en') {
  await installMock(page.context(), role, lang)
  await page.goto('/submissions/new')
  await page.locator('main h1').waitFor()
  await page.waitForLoadState('networkidle')
}

async function readSlip(page: Page) {
  await page.locator('[data-ai-open]').click()
  const panel = page.locator('[data-ai-panel]')
  await panel.getByRole('radio', { name: 'Pasted text' }).click()
  await panel.locator('[data-ai-text]').fill(SLIP)
  await panel.locator('[data-ai-read]').click()
  await expect(panel.locator('[data-ai-result]')).toBeVisible()
  return panel
}

test('fill a submission from a slip: suggestions with confidence and source, matches, duplicates; nothing saved until Save', async ({ page }) => {
  const writes: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/rest\/v1\/submissions/.test(r.url())) writes.push(r.url())
  })
  await openForm(page)
  const panel = await readSlip(page)
  const field = (k: string) => panel.locator(`[data-ai-field="${k}"]`)
  // the MGA is matched to the counterparty despite the different spelling
  await expect(field('mga_id')).toContainText('Silk Road Underwriting Agency')
  await expect(field('mga_id').getByRole('checkbox')).toBeChecked()
  // the broker is not a counterparty: shown, not usable
  await expect(field('broker_id')).toContainText('is not in Counterparties')
  await expect(field('broker_id').getByRole('checkbox')).toBeDisabled()
  // a doubtful premium is shown but left unticked; a bad date is refused
  await expect(field('gross_premium_100').locator('[data-confidence="low"]')).toBeVisible()
  await expect(field('gross_premium_100').getByRole('checkbox')).not.toBeChecked()
  await expect(field('period_to')).toContainText('is not a date')
  // the source snippet and the notes
  await expect(field('sum_insured_100')).toContainText('TSI USD 180,000,000')
  await expect(panel.locator('[data-ai-notes]')).toContainText('indication only')
  // already in the register?
  await expect(panel.locator('[data-ai-duplicates]')).toContainText('Navoiyazot Chemical Plant')
  await expect(panel.locator('[data-ai-duplicates]')).toContainText('same MGA')

  const n = await panel.locator('[data-ai-suggestions] input[type="checkbox"]:checked').count()
  await panel.locator('[data-ai-apply]').click()
  await expect(page.locator('[data-ai-banner]')).toContainText(`${n} fields filled by AI`)
  await expect(page.locator('#insured_name')).toHaveValue('JSC Navoiyazot Chemical Plant')
  await expect(page.locator('#insured_name')).toHaveAttribute('data-ai', 'high')
  await expect(page.locator('#sum_insured_100')).toHaveValue('180000000')
  await expect(page.locator('#lob_id')).not.toHaveValue('')
  await expect(page.locator('#period_to')).toHaveValue('')
  // nothing saved yet
  expect(writes).toEqual([])
  // editing a field takes its mark away
  await page.locator('#insured_name').fill('Navoiyazot Chemical Plant')
  await expect(page.locator('#insured_name')).not.toHaveAttribute('data-ai')
  await expect(page.locator('[data-ai-banner]')).toContainText(`${n - 1} fields filled by AI`)
  // the user saves
  await page.locator('#period_to').fill('2027-12-31')
  await page.getByRole('button', { name: 'Create submission' }).click()
  await expect.poll(() => writes.length).toBe(1)
})

test('the same document again comes from the cache; a file works like pasted text', async ({ page }) => {
  await openForm(page)
  await page.locator('[data-ai-open]').click()
  const panel = page.locator('[data-ai-panel]')
  const file = { name: 'slip.txt', mimeType: 'text/plain', buffer: Buffer.from(SLIP) }
  await panel.locator('[data-ai-file]').setInputFiles(file)
  await panel.locator('[data-ai-read]').click()
  await expect(panel.locator('[data-ai-result]')).toContainText('Read by claude-haiku-5-5')
  await panel.getByRole('button', { name: 'Read another' }).click()
  await panel.locator('[data-ai-file]').setInputFiles(file)
  await panel.locator('[data-ai-read]').click()
  await expect(panel.locator('[data-ai-result]')).toContainText('Read before: the saved answer')
})

test('bordereau wizard: AI suggests the column mapping, each with its confidence', async ({ page }) => {
  await installMock(page.context(), 'admin', 'en')
  await page.goto(`/binders/${BINDER_LIVE}`)
  await page.getByRole('button', { name: 'Upload bordereau' }).click()
  const w = page.locator('[data-bordereau-wizard]')
  await w.getByLabel('Kind').selectOption({ label: 'Claims' })
  const rows = [['CLM #', 'Loss happened', 'Money', 'Settled so far', 'Still open'], ['C-1', '2026-06-01', 'USD', '100', '200']]
  await w.locator('[data-bdx-file]').setInputFiles({ name: 'claims.csv', mimeType: 'text/csv', buffer: Buffer.from(rows.map((r) => r.join(';')).join('\n')) })
  await w.locator('[data-file-summary]').waitFor()
  await w.getByRole('button', { name: 'Next' }).click()
  await expect(w.getByLabel('Paid 100 %')).toHaveValue('')
  await w.locator('[data-ai-mapping]').click()
  await expect(w.getByLabel('Paid 100 %')).toHaveValue('Settled so far')
  await expect(w.getByLabel('Cedent’s claim ref.')).toHaveValue('CLM #')
  await expect(w.locator('[data-mapping] [data-confidence="high"]').first()).toBeVisible()
})

test('Admin › AI: switch off, roles; the usage log with its search; management never sees the button', async ({ page }) => {
  await openForm(page, 'management')
  await expect(page.locator('[data-ai-open]')).toHaveCount(0)

  await openForm(page, 'admin')
  await readSlip(page)
  await page.keyboard.press('Escape')
  await page.goto('/admin?tab=ai')
  const tab = page.locator('[data-ai-admin]')
  await expect(tab.locator('tbody tr')).toHaveCount(1)
  await expect(tab.locator('tbody')).toContainText('Submission document')
  await page.locator('header').getByRole('combobox').fill('status:error')
  await page.keyboard.press('Enter')
  await page.waitForLoadState('networkidle')
  await expect(tab.getByText('No AI requests yet')).toBeVisible()
  // switched off: the button goes
  await tab.locator('[data-ai-enabled]').uncheck()
  await tab.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await page.goto('/submissions/new')
  await page.locator('main h1').waitFor()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[data-ai-open]')).toHaveCount(0)
})

test('Russian and Uzbek', async ({ page }) => {
  await openForm(page, 'underwriter', 'ru')
  await expect(page.locator('[data-ai-open]')).toHaveText(/Заполнить из документа/)
  await openForm(page, 'underwriter', 'uz')
  await expect(page.locator('[data-ai-open]')).toHaveText(/Hujjatdan toʻldirish/)
})
