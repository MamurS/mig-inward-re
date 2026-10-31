/**
 * Phase 2 / step 5 — premium on the dashboard and the counterparty page:
 * the figures match the Receivables register they open, payable stays apart,
 * demo rows count only in Demo mode, finance sees the dashboard, and the
 * premium settings are in Admin › Settings.
 */
import { expect, test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'

const section = (page: Page) => page.locator('[data-premium-dashboard]')
const attention = (page: Page) => page.locator('[data-attention]')
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
  await attention(page).locator('[data-most-overdue] li').first().waitFor()
  const days = await attention(page).locator('[data-most-overdue] li').evaluateAll((els) => els.map((e) => Number(/(\d+)\s*d/.exec(e.textContent ?? '')?.[1] ?? 0)))
  expect(days.length).toBeGreaterThan(0)
  expect(days).toEqual([...days].sort((a, b) => b - a))
})

test('dashboard order: KPIs, needs attention, premium, claims, binders, analytics; the switcher jumps and marks the section', async ({ page }) => {
  await installMock(page.context(), 'management', 'en')
  await page.goto('/dashboard')
  await section(page).waitFor()
  await page.locator('[data-claims-dashboard]').waitFor()
  // the order on the page
  const order = await page.locator('main h2').allTextContents()
  expect(order).toEqual(['Needs attention', 'Premium', 'Claims', 'Binders', 'Analytics'])
  // needs attention: every list, at most five rows, each opens the filtered register
  const lists = ['overdue-follow-ups', 'oldest-offers', 'most-overdue', 'large-losses', 'cash-calls', 'bordereaux-to-chase']
  for (const l of lists) await expect(attention(page).locator(`[data-attention-card="${l}"]`)).toBeVisible()
  for (const n of await attention(page).locator('[data-ref-list]').evaluateAll((els) => els.map((e) => e.children.length))) expect(n).toBeLessThanOrEqual(5)
  await attention(page).locator('[data-attention-card="oldest-offers"]').getByRole('link', { name: 'Open in register' }).click()
  await expect(page).toHaveURL(/\/submissions\?q=status/)
  await page.goBack()
  await section(page).waitFor()

  // the switcher: sticky, jumps to the section and marks it; keyboard works
  const nav = page.getByRole('navigation', { name: 'Dashboard sections' })
  await expect(nav.getByRole('link')).toHaveText(['Overview', 'Premium', 'Claims', 'Binders', 'Analytics'])
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'location')
  await nav.getByRole('link', { name: 'Claims' }).click()
  await expect(nav.getByRole('link', { name: 'Claims' })).toHaveAttribute('aria-current', 'location')
  await expect(page.locator('#dash-claims')).toBeFocused()
  await expect.poll(async () => {
    const h = (await page.locator('#dash-claims').boundingBox())!
    const n = (await nav.boundingBox())!
    return h.y >= n.y + n.height - 1 && h.y < n.y + n.height + 48
  }).toBe(true)
  expect((await nav.boundingBox())!.y).toBeGreaterThanOrEqual(0)
  await nav.getByRole('link', { name: 'Binders' }).focus()
  await page.keyboard.press('Enter')
  await expect(nav.getByRole('link', { name: 'Binders' })).toHaveAttribute('aria-current', 'location')
  await expect(nav.getByRole('link', { name: 'Claims' })).not.toHaveAttribute('aria-current', 'location')
  await nav.getByRole('link', { name: 'Overview' }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test('needs attention shows only what the role may see', async ({ browser }) => {
  for (const [role, shown, hidden] of [
    ['claims', ['overdue-follow-ups', 'oldest-offers', 'large-losses', 'cash-calls', 'bordereaux-to-chase'], ['most-overdue']],
    ['finance', ['most-overdue', 'large-losses', 'cash-calls', 'bordereaux-to-chase'], []],
  ] as const) {
    const context = await browser.newContext()
    await installMock(context, role, 'en')
    const page = await context.newPage()
    await page.goto('/dashboard')
    await attention(page).locator('[data-attention-card="bordereaux-to-chase"]').waitFor()
    for (const l of shown) await expect(attention(page).locator(`[data-attention-card="${l}"]`), `${role}: ${l}`).toBeVisible()
    for (const l of hidden) await expect(attention(page).locator(`[data-attention-card="${l}"]`), `${role}: ${l}`).toHaveCount(0)
    const links = page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('link')
    if (role === 'claims') {
      await expect(links).toHaveText(['Overview', 'Claims', 'Binders', 'Analytics'])
      await expect(page.locator('[data-premium-dashboard]')).toHaveCount(0)
    }
    await context.close()
  }
})

test('charts: ageing bars light to dark, the funnel in status colours, the month axis not cut', async ({ page }) => {
  await installMock(page.context(), 'management', 'en')
  await page.goto('/dashboard')
  await section(page).waitFor()
  // overdue premium by age: the same stacked bar as Receivables; 0–30 clearly lighter than 31–60
  const bar = section(page).locator('[data-ageing-bar]')
  await expect(bar).toBeVisible()
  await expect(page.locator('[data-dash-charts] [data-ageing-bar] span').first()).toBeVisible()
  // offers by age (0–30 and 31–60 both drawn), in every theme
  for (const theme of ['grey', 'blue', 'green', 'orange'] as const) {
    const context = await page.context().browser()!.newContext()
    await installMock(context, 'management', 'en', { theme })
    const p = await context.newPage()
    await p.goto('/dashboard')
    const seg = (b: string) => p.locator(`[data-dash-charts] [data-ageing-bar] [data-bucket="${b}"]`)
    await seg('31-60').waitFor()
    const luma = (el: Element) => {
      const [r, g, b] = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const l0 = await seg('0-30').evaluate(luma)
    const l1 = await seg('31-60').evaluate(luma)
    expect(l0 - l1, theme).toBeGreaterThan(60)
    await context.close()
  }
  // the funnel: the status badges' colours, not the ageing solids
  const fills = await page.locator('[data-dash-charts] .recharts-bar-rectangle path').evaluateAll((els) => els.map((e) => e.getAttribute('fill')))
  expect(fills).toContain('var(--color-status-offered-line)')
  for (const f of fills) expect(f).not.toMatch(/aging/)
  // the top tick of the monthly chart is whole («100.00K», never «00K»)
  await page.locator('[data-dash-charts] .recharts-yAxis-tick-labels text').first().waitFor()
  const ticks = await page.locator('[data-dash-charts] .recharts-yAxis-tick-labels text').evaluateAll((els) =>
    els.map((e) => ({ text: e.textContent ?? '', left: e.getBoundingClientRect().left, axis: e.closest('.recharts-wrapper')!.getBoundingClientRect().left })))
  expect(ticks.length).toBeGreaterThan(1)
  for (const t of ticks) expect(t.left, t.text).toBeGreaterThanOrEqual(t.axis)
})

test('demo rows count only in Demo mode', async ({ browser }) => {
  for (const demoMode of [false, true]) {
    const context = await browser.newContext()
    await installMock(context, 'management', 'en', { demoMode })
    const page = await context.newPage()
    await page.goto('/dashboard')
    await attention(page).locator('[data-most-overdue]').waitFor()
    const insured = await attention(page).locator('[data-most-overdue] li').allTextContents()
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
