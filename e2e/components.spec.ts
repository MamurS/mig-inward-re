/**
 * Phase 2 components, end to end on the offline mock (DESIGN.md «Tables»,
 * «Command palette», «Side panels», «Forms»): what the user can do and that
 * the app remembers it.
 */
import { expect, test } from '@playwright/test'
import { installMock } from './support/mockSupabase'

test.describe('table v2 on the register', () => {
  test('rows are regular height (48 px); there is no density switch', async ({ page }) => {
    await installMock(page.context(), 'underwriter', 'en')
    await page.goto('/submissions')
    const row = page.locator('main tbody tr').first()
    await row.waitFor()
    expect(Math.round((await row.boundingBox())!.height)).toBe(48)
    await expect(page.getByRole('button', { name: 'Density' })).toHaveCount(0)
  })

  test('columns can be hidden, and stay hidden', async ({ browser }) => {
    const context = await browser.newContext()
    await installMock(context, 'underwriter', 'en')
    const page = await context.newPage()
    await page.goto('/submissions')
    await page.locator('main tbody tr').first().waitFor()
    await expect(page.locator('main thead').getByText('Line of business')).toBeVisible()
    await page.getByRole('button', { name: 'Columns' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Line of business' }).click()
    await page.keyboard.press('Escape')
    await expect(page.locator('main thead').getByText('Line of business')).toHaveCount(0)
    await page.reload()
    await page.locator('main tbody tr').first().waitFor()
    await expect(page.locator('main thead').getByText('Line of business')).toHaveCount(0)
    await context.close()
  })

  test('sticky header and frozen first column', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1024, height: 700 } })
    await installMock(context, 'underwriter', 'en')
    const page = await context.newPage()
    await page.goto('/submissions')
    await page.locator('main tbody tr').first().waitFor()
    const scroller = page.locator('main table').locator('xpath=..')
    const head = page.locator('main thead th').nth(1)
    const first = page.locator('main tbody tr').first().locator('td').first()
    const h0 = (await head.boundingBox())!
    const f0 = (await first.boundingBox())!
    // at rest the first header cell looks like the others: same bottom line, no divider
    const style = (i: number) => page.locator('main thead th').nth(i).evaluate((el) => {
      const cs = getComputedStyle(el)
      return { border: `${cs.borderBottomWidth} ${cs.borderBottomColor}`, shadow: cs.boxShadow }
    })
    const [s0, s1] = [await style(0), await style(1)]
    expect(s0.border).toBe(s1.border)
    expect(s0.shadow).toBe('none')
    await scroller.evaluate((el) => el.scrollBy(400, 200))
    await page.waitForTimeout(100)
    // scrolled sideways: the frozen column shows its divider
    expect((await style(0)).shadow).not.toBe('none')
    expect(await first.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none')
    expect((await page.locator('main thead th').first().boundingBox())!.y).toBeCloseTo(h0.y, 0)
    expect((await page.locator('main tbody tr').nth(5).locator('td').first().boundingBox())!.x).toBeCloseTo(f0.x, 0)
    await context.close()
  })

  test('search highlights matches; no results shows the empty state', async ({ browser }) => {
    const context = await browser.newContext()
    await installMock(context, 'underwriter', 'en')
    const page = await context.newPage()
    await page.goto('/submissions?q=Tashkent')
    await page.locator('main tbody tr').first().waitFor()
    await expect(page.locator('main tbody mark').first()).toHaveText(/tashkent/i)
    await page.goto('/submissions?q=zzzz-nothing')
    await expect(page.getByText('No submissions match the filters.')).toBeVisible()
    await expect(page.locator('main tbody svg[viewBox="0 0 64 64"]')).toBeVisible()
    await context.close()
  })

  test('row selection shows the bulk bar without moving the page', async ({ browser }) => {
    const context = await browser.newContext()
    await installMock(context, 'underwriter', 'en')
    const page = await context.newPage()
    await page.goto('/submissions')
    await page.locator('main tbody tr').first().waitFor()
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    const before = await page.locator('main table').boundingBox()
    await page.getByRole('checkbox', { name: 'Select row' }).nth(0).check()
    await page.getByRole('checkbox', { name: 'Select row' }).nth(2).check()
    await expect(page.getByRole('toolbar', { name: 'Actions for selected rows' })).toContainText('2 selected')
    expect(await page.locator('main table').boundingBox()).toEqual(before)
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByRole('toolbar', { name: 'Actions for selected rows' })).toHaveCount(0)
    await context.close()
  })

  test('quick view opens a side panel from a row', async ({ browser }) => {
    const context = await browser.newContext()
    await installMock(context, 'underwriter', 'en')
    const page = await context.newPage()
    await page.goto('/submissions')
    const row = page.locator('main tbody tr').first()
    await row.hover()
    await row.getByRole('button', { name: 'Quick view' }).click()
    const panel = page.getByRole('dialog')
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('link', { name: 'Open submission' })).toBeVisible()
    await page.waitForTimeout(450) // the slide-in (240 ms)
    const box = (await panel.boundingBox())!
    expect(box.x + box.width).toBeCloseTo(page.viewportSize()!.width, 0) // docked right
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await context.close()
  })
})

test('quick view on the agenda and the counterparties list', async ({ browser }) => {
  const context = await browser.newContext()
  await installMock(context, 'underwriter', 'en')
  const page = await context.newPage()
  await page.goto('/agenda')
  const item = page.locator('main .group').first()
  await item.hover()
  await item.getByRole('button', { name: 'Quick view' }).click()
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Open submission' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('/counterparties')
  const row = page.locator('main tbody tr').first()
  await row.hover()
  await row.getByRole('button', { name: 'Quick view' }).click()
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Open counterparty' })).toBeVisible()
  await context.close()
})

test('search bar: Ctrl K, a direct hit opens the record, pages are reachable', async ({ browser }) => {
  const context = await browser.newContext()
  await installMock(context, 'underwriter', 'en')
  const page = await context.newPage()
  await page.goto('/agenda')
  await page.locator('main h1').waitFor()
  await page.keyboard.press('Control+k')
  const box = page.getByRole('combobox')
  await expect(box).toBeFocused()
  await box.fill('SUB-2026-0002')
  const hit = page.getByRole('option', { name: /SUB-2026-0002/ })
  await expect(hit).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await expect(hit).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]{36}$/)
  await expect(page.locator('main')).toContainText('SUB-2026-0002')

  await page.keyboard.press('Control+k')
  await page.getByRole('combobox').fill('counterp')
  const nav = page.getByRole('option', { name: /Counterparties/ })
  await expect(nav).toBeVisible()
  await nav.click()
  await expect(page).toHaveURL(/\/counterparties$/)
  await context.close()
})

test('forms: validation on blur, outcome-named submit, sticky footer', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await installMock(context, 'underwriter', 'en')
  const page = await context.newPage()
  await page.goto('/submissions/new')
  const insured = page.locator('#insured_name')
  await insured.waitFor()
  await insured.focus()
  await expect(page.getByRole('alert')).toHaveCount(0) // nothing shouts before the user leaves the field
  await insured.blur()
  await expect(page.getByRole('alert').first()).toBeVisible()
  const submit = page.getByRole('button', { name: 'Create submission' })
  await expect(submit).toBeInViewport() // sticky footer, even at the top of a long form
  await page.mouse.wheel(0, 2000)
  await expect(submit).toBeInViewport()
  await context.close()
})

test('task dialogs open as side panels with the footer pinned', async ({ browser }) => {
  const context = await browser.newContext()
  await installMock(context, 'underwriter', 'en')
  const page = await context.newPage()
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Done', exact: true }).first().click()
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()
  await page.waitForTimeout(450)
  const box = (await panel.boundingBox())!
  expect(box.y).toBe(0)
  expect(box.height).toBe(page.viewportSize()!.height)
  const done = panel.getByRole('button', { name: 'Close follow-up' })
  const b = (await done.boundingBox())!
  expect(b.y + b.height).toBeGreaterThan(box.height - 80) // in the footer at the bottom edge
  await context.close()
})
