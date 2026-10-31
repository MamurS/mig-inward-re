/**
 * Phase 2 / step 4 — receivables, end to end on the offline mock: the
 * register (oldest due first, receivable and payable apart), the ageing
 * summary in USD over exactly the rows shown, the search words overdue>45 /
 * bucket:61-90 / payable, export = what is shown, finance-team follow-ups on
 * the agenda (closing one records who closed it), and who may see what.
 */
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import { installMock } from './support/mockSupabase'
import { USERS } from './support/fixtures'

const rows = (page: Page) => page.locator('main tbody tr')
const bar = (page: Page) => page.locator('header').getByRole('combobox')
const ageing = (page: Page) => page.locator('[data-ageing]')
/** The «Days overdue» column (0 = not yet due). */
const daysOf = async (page: Page) =>
  (await page.locator('main tbody tr td:nth-child(4)').allTextContents()).map((t) => Number(/(\d+)/.exec(t)?.[1] ?? 0))
/** Types a query and waits until the list shows its result (the count above it matches the rows). */
const search = async (page: Page, q: string) => {
  await bar(page).fill(q)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(q).replace(/[%+]/g, (c) => `\\${c}`)}`))
  await page.waitForLoadState('networkidle')
}

async function open(page: Page, role: 'finance' | 'management' | 'admin' = 'finance', lang: 'en' | 'ru' | 'uz' = 'en') {
  await installMock(page.context(), role, lang)
  await page.goto('/receivables')
  await rows(page).first().waitFor()
}

test('the register: what is still owed, oldest due first; ageing over the rows shown', async ({ page }) => {
  await open(page)
  await expect(page.locator('main h1')).toHaveText('Receivables')
  await expect(page.locator('aside').getByRole('link', { name: 'Receivables' })).toBeVisible()
  const n = await rows(page).count()
  expect(n).toBeGreaterThan(2)
  // no return premium, nothing paid in full, no demo row
  await expect(page.locator('main tbody')).not.toContainText('Return')
  await expect(page.locator('main tbody')).not.toContainText('DEMO')
  for (const t of await rows(page).allTextContents()) expect(t).not.toMatch(/\bPaid\b(?! )/)
  // oldest due first: days overdue never go up down the list
  const days = await daysOf(page)
  expect(days).toEqual([...days].sort((a, b) => b - a))
  // the tiles: every bucket, not yet due, and payable apart
  for (const label of ['Outstanding', 'Not yet due', '0-30 days', '31-60 days', '61-90 days', '90+ days', 'Payable to MGAs']) {
    await expect(ageing(page)).toContainText(label)
  }
  await expect(bar(page)).toHaveAttribute('placeholder', 'Search or filter: insured, MGA, overdue>45, bucket:61-90…')
})

test('overdue>45, bucket tiles, payable', async ({ page }) => {
  await open(page)
  await search(page, 'overdue>45')
  await expect(page.locator('main [data-chip]').first()).toContainText('Days overdue')
  await expect.poll(async () => (await daysOf(page)).every((d) => d > 45)).toBe(true)
  expect((await daysOf(page)).length).toBeGreaterThan(0)

  // a bucket tile filters by it
  await ageing(page).getByRole('link', { name: /90\+ days/ }).click()
  await expect(page).toHaveURL(/q=bucket%3A90%2B/)
  await page.waitForLoadState('networkidle')
  await expect.poll(async () => (await daysOf(page)).every((d) => d > 90)).toBe(true)
  await search(page, 'bucket:31-60')
  await expect.poll(async () => (await daysOf(page)).every((d) => d > 30 && d <= 60)).toBe(true)
  expect((await daysOf(page)).length).toBeGreaterThan(0)

  // payable: return premium we owe, never mixed into what MGAs owe
  await search(page, 'payable')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Tashkent City Mall')
  await expect(page.locator('main thead')).toContainText('Payable to MGA')
  await expect(page.locator('main')).toContainText('1 return premium to pay')
})

test('Russian words: просрочено>45, корзина:61-90', async ({ page }) => {
  await open(page, 'finance', 'ru')
  await expect(page.locator('main h1')).toHaveText('Дебиторская задолженность')
  await search(page, 'просрочено>45')
  await expect(page.locator('main [data-chip]').first()).toContainText('Дней просрочки')
  await installMock(page.context(), 'finance', 'uz')
  await page.goto('/receivables')
  await expect(page.locator('main h1')).toHaveText('Debitorlik qarzi')
})

test('export contains exactly the installments shown', async ({ page }) => {
  await open(page)
  await search(page, 'overdue')
  // the previous rows stay on screen while the filtered list loads: count only once every row is overdue
  await expect.poll(async () => (await daysOf(page)).every((d) => d > 0)).toBe(true)
  const shown = await rows(page).count()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export to Excel' }).click()])
  const zip = unzipSync(new Uint8Array(readFileSync((await download.path())!)))
  expect((strFromU8(zip['xl/worksheets/sheet1.xml']).match(/<row /g) ?? []).length - 1).toBe(shown)
})

test('finance agenda: team follow-ups for overdue premium; closing records who closed it', async ({ page }) => {
  await installMock(page.context(), 'finance', 'en')
  await page.goto('/agenda')
  const item = page.locator('main').getByText('Premium overdue').first()
  await expect(item).toBeVisible()
  await expect(page.locator('main')).toContainText('Finance team')
  await expect(page.locator('aside').getByRole('link', { name: /My agenda/ })).toContainText(/\d/)
  const card = page.locator('main [class*="rounded-md border"]').filter({ hasText: 'Premium overdue' }).first()
  const ref = (await card.locator('a').first().textContent())!
  await card.getByRole('button', { name: 'Done' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Outcome').fill('Chased the MGA, payment promised')
  await dlg.getByRole('button', { name: 'Close follow-up' }).click()
  await expect(page.getByText('Follow-up closed')).toBeVisible()
  await page.getByRole('tab', { name: 'Done (last 30 days)' }).click()
  const done = page.locator('main [class*="rounded-md border"]').filter({ hasText: ref }).first()
  await expect(done).toContainText(`(${USERS.finance.full_name})`)
  await expect(done).toContainText('Chased the MGA')
})

test('who may see it: management reads; underwriters have no register', async ({ page }) => {
  await open(page, 'management')
  await expect(rows(page).first()).toBeVisible()
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto('/receivables')
  await expect(page.locator('aside').getByRole('link', { name: 'Receivables' })).toHaveCount(0)
  await expect(page.locator('main tbody tr')).toHaveCount(0)
})
