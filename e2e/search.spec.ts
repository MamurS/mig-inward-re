/**
 * The one search bar, end to end on the offline mock (which evaluates the
 * same PostgREST filters the database gets): typing filters live, chips read
 * the query back and remove their part, OR groups, URL round trip and
 * Back / Forward, Ctrl K from anywhere, suggestions by keyboard, recent
 * searches, the export matching the results, links filling the bar, and the
 * bar's look in every theme and text size.
 */
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import { installMock } from './support/mockSupabase'
import { TABLES } from './support/fixtures'

const bar = (page: Page) => page.getByRole('combobox', { name: 'Search or filter submissions' })
const chips = (page: Page) => page.locator('main [data-chip]')
const rows = (page: Page) => page.locator('main tbody tr')
const countOf = (status: string[]) => TABLES.submissions.filter((s) => status.includes(String(s.status))).length

async function register(page: Page, q = '') {
  await page.goto(q ? `/submissions?q=${encodeURIComponent(q)}` : '/submissions')
  await rows(page).first().waitFor()
}

test('typing filters the register live; chips and the count read it back', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await register(page)
  await bar(page).click()
  await bar(page).fill('bound')
  await expect(page).toHaveURL(/\?q=bound$/)
  await expect(chips(page)).toHaveCount(1)
  await expect(chips(page).first()).toContainText('Status: Bound')
  const n = countOf(['bound'])
  await expect(page.getByText(`${n} submissions`)).toBeVisible()
  await expect(rows(page)).toHaveCount(n)
  for (const badge of await rows(page).locator('td').filter({ hasText: /^(Bound|Offered|Declined|NTU|Received|Under review|No response)$/ }).allTextContents()) {
    expect(badge).toBe('Bound')
  }
})

test('free text: partial words, any field, diacritics and case ignored', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await register(page, 'TASHK')
  await expect(rows(page).first()).toBeVisible()
  const n = TABLES.submissions.filter((s) => String(s.search_text).includes('tashk')).length
  await expect(rows(page)).toHaveCount(n)
  await expect(page.locator('main tbody mark').first()).toHaveText(/tashk/i)
  await register(page, '"Tashkent City Mall"')
  await expect(rows(page)).toHaveCount(1)
})

test('removing a chip removes its part of the text', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await register(page, 'Caspian Specialty MGA, bound')
  await expect(chips(page)).toHaveCount(2)
  await expect(chips(page).nth(0)).toContainText('MGA: Caspian Specialty MGA')
  await chips(page).nth(1).getByRole('button').click()
  await expect(bar(page)).toHaveValue('Caspian Specialty MGA')
  await expect(chips(page)).toHaveCount(1)
  await expect(page).toHaveURL(/q=Caspian\+Specialty\+MGA$/)
})

test('OR groups, exclusions, and parts searched as text', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await register(page, 'status:declined; ntu')
  await expect(page.locator('main [data-search-chips]')).toContainText('or')
  await expect(rows(page)).toHaveCount(countOf(['declined', 'ntu']))

  await register(page, '-bound, -declined')
  await expect(chips(page).first()).toContainText('Not Status: Bound')
  await expect(rows(page)).toHaveCount(TABLES.submissions.length - countOf(['bound', 'declined']))

  await register(page, 'Tashkent, foo:bar')
  await expect(chips(page).nth(1)).toContainText('searched as text')
  await expect(page.getByText('No submissions match the filters.')).toBeVisible()
})

test('the URL keeps the search: reload, Back and Forward', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await register(page, 'bound')
  await expect(bar(page)).toHaveValue('bound')
  await bar(page).click()
  await bar(page).fill('declined')
  await expect(page).toHaveURL(/\?q=declined$/)
  await expect(chips(page).first()).toContainText('Status: Declined')
  await page.goBack()
  await expect(page).toHaveURL(/\?q=bound$/)
  await expect(bar(page)).toHaveValue('bound')
  await expect(chips(page).first()).toContainText('Status: Bound')
  await page.goForward()
  await expect(bar(page)).toHaveValue('declined')
  await page.reload()
  await expect(bar(page)).toHaveValue('declined')
  await expect(chips(page).first()).toContainText('Status: Declined')
})

test('Ctrl K from another page; Enter opens the register with the query', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await page.goto('/agenda')
  await page.locator('main h1').waitFor()
  await page.keyboard.press('Control+k')
  await expect(bar(page)).toBeFocused()
  await page.keyboard.type('overdue')
  await page.keyboard.press('Escape') // closes the suggestions only
  await expect(page.locator('#search-suggestions')).toHaveCount(0)
  await expect(bar(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/submissions\?q=overdue$/)
  await expect(chips(page).first()).toContainText('Follow-up overdue')
  await expect(rows(page)).toHaveCount(TABLES.submissions.filter((s) => s.follow_up_overdue).length)
})

test('suggestions: arrows, Enter inserts field:value, Tab completes', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await register(page)
  await bar(page).click()
  await page.keyboard.type('mga:sil')
  const opt = page.getByRole('option', { name: /Silk Road Underwriting Agency/ })
  await expect(opt).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await expect(opt).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(bar(page)).toHaveValue('mga:"Silk Road Underwriting Agency"')

  await page.keyboard.type(', status:off')
  await page.keyboard.press('Tab')
  await expect(bar(page)).toHaveValue('mga:"Silk Road Underwriting Agency", status:offered')
  await expect(bar(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(chips(page)).toHaveCount(2)
  const n = TABLES.submissions.filter((s) => s.mga_name === 'Silk Road Underwriting Agency' && s.status === 'offered').length
  await expect(page.getByText(new RegExp(`^${n} submissions?$`))).toBeVisible()
})

test('recent searches come back, and can be removed', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await register(page)
  await bar(page).click()
  await bar(page).fill('status:offered')
  await page.keyboard.press('Enter')
  await bar(page).fill('')
  await bar(page).click()
  const recent = page.getByRole('option', { name: 'status:offered' })
  await expect(recent).toBeVisible()
  await recent.getByRole('button', { name: 'Remove from recent searches' }).click()
  await expect(recent).toHaveCount(0)
})

test('help popover: examples in the UI language, one click tries one', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'ru')
  await register(page)
  await page.getByRole('combobox').click()
  await page.getByRole('button', { name: 'Справка по синтаксису' }).click()
  const help = page.getByRole('dialog', { name: 'Как искать' })
  await expect(help).toBeVisible()
  await help.getByRole('button', { name: /-declined/ }).click()
  await expect(page.getByRole('combobox')).toHaveValue('-declined')
  await expect(chips(page).first()).toContainText('Не Статус: Отклонена')
})

test('Russian and Uzbek words', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'ru')
  await register(page, 'связан')
  await expect(chips(page).first()).toContainText('Статус: Подтверждена')
  await expect(page.getByText(new RegExp(`^${countOf(['bound'])} заяв`))).toBeVisible()
  await installMock(page.context(), 'underwriter', 'uz')
  await register(page, 'holat:bog‘langan, валюта:usd')
  await expect(chips(page)).toHaveCount(2)
  await expect(chips(page).first()).toContainText('Tasdiqlandi')
})

test('export contains exactly the rows the query shows', async ({ page }) => {
  await installMock(page.context(), 'underwriter', 'en')
  await register(page, 'status:offered|no_response; premium>50k')
  const shown = await rows(page).count()
  await expect(page.getByText(new RegExp(`^${shown} submissions?$`))).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export to Excel' }).click()])
  const zip = unzipSync(new Uint8Array(readFileSync((await download.path())!)))
  const sheet = strFromU8(zip['xl/worksheets/sheet1.xml'])
  const exported = (sheet.match(/<row /g) ?? []).length - 1 // minus the header
  expect(exported).toBe(shown)
  const refs = await rows(page).locator('td a').allTextContents()
  for (const ref of refs) expect(sheet.includes(ref) || strFromU8(zip['xl/sharedStrings.xml'] ?? new Uint8Array()).includes(ref)).toBe(true)
})

test('dashboard tiles and old links fill the bar with the equivalent query', async ({ browser }) => {
  const context = await browser.newContext()
  await installMock(context, 'management', 'en')
  const page = await context.newPage()
  await page.goto('/dashboard')
  await page.getByRole('link', { name: /Overdue follow-ups/ }).click()
  await expect(page).toHaveURL(/\/submissions\?q=overdue$/)
  await expect(bar(page)).toHaveValue('overdue')

  await page.goto('/submissions?status=offered,no_response&overdue=1')
  await expect(bar(page)).toHaveValue('status:offered|no_response, overdue')
  await expect(page).toHaveURL(/\?q=status%3Aoffered%7Cno_response%2C\+overdue$/)
  await context.close()
})

for (const theme of ['grey', 'blue', 'green', 'orange'] as const) {
  for (const textSize of ['normal', 'large'] as const) {
    test(`the bar looks right · ${theme} · ${textSize}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      await installMock(context, 'underwriter', 'en', { theme, textSize })
      const page = await context.newPage()
      await register(page, 'bound')
      const shell = page.locator('[data-search-bar]')
      const closed = (await shell.boundingBox())!
      expect(closed.height).toBeCloseTo(44 + 2, 0) // 44 px pill + hairline border
      expect(await shell.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)')
      expect(await shell.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThanOrEqual(22)
      // the page title does not move when the suggestions open (the panel floats over the page)
      const title = (await page.locator('main h1').boundingBox())!
      await bar(page).click()
      await expect(page.locator('#search-suggestions')).toBeVisible()
      const open = (await shell.boundingBox())!
      expect(open.width).toBeCloseTo(closed.width, 0) // the panel continues the pill: same width
      expect(open.height).toBeGreaterThan(closed.height)
      expect((await page.locator('main h1').boundingBox())!.y).toBeCloseTo(title.y, 0)
      // placeholder fits or truncates — the bar never pushes the page sideways
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
      await context.close()
    })
  }
}
