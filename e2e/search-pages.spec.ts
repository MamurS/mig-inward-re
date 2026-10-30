/**
 * The top bar is the only search / filter control on every page: it searches
 * that page's list, with the page's placeholder, words and filter builder.
 * Counterparties, Agenda, Admin (users, reference data, FX rates), and pages
 * without a list of their own.
 */
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import { installMock } from './support/mockSupabase'
import { SEEN } from './support/fixtures'

const bar = (page: Page) => page.locator('header').getByRole('combobox')
const chips = (page: Page) => page.locator('main [data-chip]')
const rows = (page: Page) => page.locator('main tbody tr')
const cps = SEEN.counterparties as { name: string; type: string; country_code: string; active: boolean }[]

async function search(page: Page, text: string) {
  await bar(page).click()
  await bar(page).fill(text)
  await page.keyboard.press('Enter')
}

test.describe('counterparties', () => {
  test('no page controls; the bar searches this list with its own words', async ({ page }) => {
    await installMock(page.context(), 'underwriter', 'en')
    await page.goto('/counterparties')
    await rows(page).first().waitFor()
    await expect(bar(page)).toHaveAttribute('placeholder', 'Search or filter: name, type, country…')
    await expect(page.locator('main input:not([type="checkbox"])')).toHaveCount(0)
    await expect(page.locator('main [role="radiogroup"]')).toHaveCount(0)
    await expect(page.getByText('Show inactive')).toHaveCount(0)
    // inactive ones are hidden until asked for
    await expect(rows(page)).toHaveCount(cps.filter((c) => c.active).length)

    await search(page, 'type:broker')
    await expect(page).toHaveURL(/\/counterparties\?q=type%3Abroker$/)
    await expect(chips(page).first()).toContainText('Type: Broker')
    await expect(rows(page)).toHaveCount(cps.filter((c) => c.active && c.type === 'broker').length)

    await search(page, 'inactive')
    await expect(chips(page).first()).toContainText('Including inactive')
    await expect(rows(page)).toHaveCount(cps.length)

    await search(page, 'aigerim') // a contact's name
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('Caspian Specialty MGA')

    await search(page, 'country:AE, -type:broker')
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('Silk Road')
  })

  test('Russian and Uzbek words, and the builder with this page’s fields', async ({ page }) => {
    await installMock(page.context(), 'underwriter', 'ru')
    await page.goto('/counterparties?q=' + encodeURIComponent('брокер'))
    await expect(chips(page).first()).toContainText('Брокер')
    await expect(rows(page)).toHaveCount(cps.filter((c) => c.active && c.type === 'broker').length)
    await page.getByRole('button', { name: 'Фильтры' }).click()
    const fb = page.getByRole('dialog', { name: 'Фильтры' })
    await expect(fb.getByRole('button', { name: 'Брокер', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await fb.getByRole('switch', { name: 'Включая неактивных' }).click()
    await fb.getByRole('button', { name: 'Брокер', exact: true }).click()
    await fb.getByRole('button', { name: 'Цедент', exact: true }).click()
    await fb.getByRole('button', { name: 'Применить' }).click()
    await expect(bar(page)).toHaveValue('type:cedent, inactive')
    await expect(rows(page)).toHaveCount(1)
    await installMock(page.context(), 'underwriter', 'uz')
    await page.goto('/counterparties?q=' + encodeURIComponent('nofaol'))
    await expect(rows(page)).toHaveCount(cps.length)
  })

  test('export contains exactly the counterparties shown', async ({ page }) => {
    await installMock(page.context(), 'underwriter', 'en')
    await page.goto('/counterparties?q=' + encodeURIComponent('mga; inactive, cedent'))
    await rows(page).first().waitFor()
    const shown = await rows(page).count()
    expect(shown).toBe(cps.filter((c) => c.type === 'mga' || c.type === 'cedent').length)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export to Excel' }).click()])
    const zip = unzipSync(new Uint8Array(readFileSync((await download.path())!)))
    const sheet = strFromU8(zip['xl/worksheets/sheet1.xml'])
    expect((sheet.match(/<row /g) ?? []).length - 1).toBe(shown)
  })

  test('one «New counterparty» button that asks for the type', async ({ page }) => {
    await installMock(page.context(), 'underwriter', 'en')
    await page.goto('/counterparties')
    await rows(page).first().waitFor()
    await expect(page.locator('main header, main').getByRole('button', { name: /^(Add|New) (MGA|broker|cedent)/i })).toHaveCount(0)
    await page.getByRole('button', { name: 'New counterparty' }).click()
    const dlg = page.getByRole('dialog', { name: 'New counterparty' })
    await dlg.getByLabel('Name').fill('Bosphorus Re')
    await expect(dlg.getByRole('button', { name: 'New counterparty' })).toBeDisabled()
    await dlg.getByRole('radio', { name: 'Cedent' }).click()
    await expect(dlg.getByRole('button', { name: /cedent/i })).toBeEnabled()
    await dlg.getByRole('button', { name: /cedent/i }).click()
    await expect(page).toHaveURL(/\/counterparties\/[0-9a-f-]{36}$/)
  })
})

test.describe('agenda', () => {
  test('the bar filters follow-ups; management can look at everyone’s', async ({ page }) => {
    await installMock(page.context(), 'management', 'en')
    await page.goto('/agenda')
    await page.locator('main h1').waitFor()
    await expect(bar(page)).toHaveAttribute('placeholder', 'Search or filter: title, submission, type, due…')
    await expect(page.locator('main select')).toHaveCount(0)
    await search(page, 'assignee:all, overdue')
    await expect(page).toHaveURL(/\/agenda\?q=/)
    await expect(chips(page)).toHaveCount(2)
    // every overdue open follow-up of the fixtures, plus the finance team's overdue-premium ones (made by the mock's daily job)
    const fu = SEEN.follow_ups_v as { done_at: string | null; is_overdue: boolean }[]
    const overdueOpen = fu.filter((f) => !f.done_at && f.is_overdue).length
    const tab = page.getByRole('tab', { name: /^Open \(\d+\)$/ })
    await expect(tab).toBeVisible()
    const shownOf = async () => Number(/\((\d+)\)/.exec((await tab.textContent()) ?? '')?.[1] ?? 0)
    // a premium follow-up links to its installment: «SUB-… #n»
    const premium = page.locator('main [role="tabpanel"] a').filter({ hasText: /#\d+$/ })
    // …and the overdue claim follow-ups (large loss → management and admin)
    const claimItems = page.locator('main [role="tabpanel"] a[href^="/claims/"]')
    await expect.poll(async () => (await shownOf()) - (await premium.count()) - (await claimItems.count())).toBe(overdueOpen)
    expect(await premium.count()).toBeGreaterThan(0)
    await search(page, 'assignee:all, zzzz-nothing')
    await expect(page.getByText('Nothing matches this search')).toBeVisible()
  })

  test('the builder shows this page’s fields', async ({ page }) => {
    await installMock(page.context(), 'underwriter', 'en')
    await page.goto('/agenda')
    await page.locator('main h1').waitFor()
    await page.getByRole('button', { name: 'Filters' }).click()
    const fb = page.getByRole('dialog', { name: 'Filters' })
    await expect(fb.getByText('Assigned to')).toBeVisible()
    await expect(fb.getByRole('button', { name: 'Request update', exact: true })).toBeVisible()
    await expect(fb.getByRole('button', { name: 'Bound', exact: true })).toHaveCount(0)
    await fb.getByRole('switch', { name: 'Overdue' }).click()
    await fb.getByRole('button', { name: 'Apply' }).click()
    await expect(bar(page)).toHaveValue('overdue')
  })
})

test.describe('admin', () => {
  test('users, reference data and FX rates each search their own list', async ({ page }) => {
    await installMock(page.context(), 'admin', 'en')
    await page.goto('/admin')
    await page.locator('main table').first().waitFor()
    await expect(bar(page)).toHaveAttribute('aria-label', 'Search or filter users')
    await search(page, 'role:finance')
    await expect(page).toHaveURL(/\/admin\?q=role%3Afinance$/)
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('fin@mig.example')

    // switching the tab starts a fresh search for that list
    await page.getByRole('tab', { name: 'Reference data' }).click()
    await expect(page).toHaveURL(/\/admin\?tab=reference$/)
    await expect(bar(page)).toHaveValue('')
    await expect(bar(page)).toHaveAttribute('aria-label', 'Search or filter reference data')
    await rows(page).first().waitFor()
    await page.waitForLoadState('networkidle')
    const before = await rows(page).count()
    await search(page, 'cargo')
    await expect.poll(() => rows(page).count()).toBeLessThan(before)
    // the rows are editable: read their inputs too
    const shown = await rows(page).evaluateAll((trs) => trs.map((tr) => `${tr.textContent} ${[...tr.querySelectorAll('input')].map((i) => i.value).join(' ')}`.toLowerCase()))
    for (const r of shown) expect(r).toContain('cargo')

    await page.getByRole('tab', { name: 'FX rates' }).click()
    await expect(bar(page)).toHaveAttribute('aria-label', 'Search or filter FX rates')
    await expect(page.locator('main select')).toHaveCount(1) // the «add a rate» form's currency, not a filter
    await search(page, 'EUR')
    await expect(chips(page).first()).toContainText('Currency: EUR')
    await expect.poll(async () => new Set((await rows(page).locator('td:first-child').allTextContents()).map((x) => x.trim()))).toEqual(new Set(['EUR']))
  })
})

test('a page without a list searches submissions', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto(`/submissions/${String(SEEN.submissions[0].id)}`)
  await page.locator('main h1').waitFor()
  await expect(bar(page)).toHaveAttribute('aria-label', 'Search or filter submissions')
  await search(page, 'bound')
  await expect(page).toHaveURL(/\/submissions\?q=bound$/)
})

const PAGES = [
  { path: '/counterparties', role: 'underwriter' as const },
  { path: '/agenda', role: 'management' as const },
  { path: '/admin?tab=users', role: 'admin' as const },
  { path: '/admin?tab=fx', role: 'admin' as const },
]
for (const theme of ['grey', 'blue', 'green', 'orange'] as const) {
  for (const textSize of ['normal', 'large'] as const) {
    test(`every page's bar and builder fit · ${theme} · ${textSize}`, async ({ browser }) => {
      for (const [i, p] of PAGES.entries()) {
        const lang = (['en', 'ru', 'uz'] as const)[i % 3]
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
        await installMock(context, p.role, lang, { theme, textSize })
        const page = await context.newPage()
        await page.goto(p.path)
        await page.locator('main h1').waitFor()
        await page.waitForLoadState('networkidle')
        const shell = page.locator('[data-search-bar]')
        expect((await shell.boundingBox())!.height).toBeCloseTo(46, 0)
        await page.locator('header').getByRole('button', { name: /^(Filters|Фильтры|Filtrlar)$/ }).click()
        const fb = page.locator('[data-filter-builder]')
        await expect(fb).toBeVisible()
        const box = (await fb.boundingBox())!
        expect(box.x + box.width, p.path).toBeLessThanOrEqual(1280)
        expect(box.y + box.height, p.path).toBeLessThanOrEqual(800)
        await expect(fb.getByRole('button', { name: /^(Apply|Применить|Qoʻllash)$/ })).toBeInViewport()
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
        await context.close()
      }
    })
  }
}
