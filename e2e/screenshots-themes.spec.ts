/**
 * Visual refresh record: the key screens in each colour theme (EN), and the
 * Dashboard and Premium tab in RU / UZ with Large text.
 * Run: SHOTS=docs/visual-refresh/screenshots npx playwright test screenshots-themes
 * Skipped unless SHOTS names an output folder.
 */
import { test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import { TABLES, type FixtureRole } from './support/fixtures'

const OUT = process.env.SHOTS
const THEMES = ['grey', 'blue', 'green', 'orange'] as const
const idOf = (insured: string) => String(TABLES.submissions.find((s) => s.insured_name === insured)!.id)

type Shot = { name: string; path: string; role: FixtureRole; ready: string; then?: (page: Page) => Promise<void>; full?: boolean }
const SHOTS: Shot[] = [
  { name: 'dashboard', path: '/dashboard', role: 'management', ready: 'main h1', full: true },
  { name: 'register', path: '/submissions', role: 'underwriter', ready: 'main tbody tr' },
  { name: 'submission-detail', path: '/submissions/30000000-0000-4000-8000-000000000002', role: 'underwriter', ready: 'main h1', full: true },
  { name: 'submission-form', path: '/submissions/30000000-0000-4000-8000-000000000014/edit', role: 'underwriter', ready: 'main form' },
  {
    name: 'premium-tab', path: `/submissions/${idOf('Tashkent City Mall')}`, role: 'finance', ready: 'main tbody tr',
    then: async (page) => {
      await page.getByRole('tab').first().scrollIntoViewIfNeeded()
      await page.evaluate(() => window.scrollBy(0, -24))
    },
  },
  {
    name: 'schedule-editor', path: `/submissions/${idOf('Emirates Aviation Services Hull')}`, role: 'underwriter', ready: 'main h1',
    then: async (page) => {
      await page.getByRole('button', { name: 'Create premium schedule' }).click()
      const panel = page.getByRole('dialog')
      await panel.getByRole('radio', { name: 'Equal installments' }).click()
      await panel.getByLabel('Number of installments').fill('4')
      await panel.locator('tbody tr').nth(3).waitFor()
    },
  },
]

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

async function capture(page: Page, s: Shot, file: string) {
  await page.goto(s.path)
  await page.locator(s.ready).first().waitFor({ timeout: 15_000 })
  await settle(page)
  if (s.then) {
    await s.then(page)
    await settle(page)
  }
  await page.screenshot({ path: `${OUT}/${file}.jpg`, type: 'jpeg', quality: 80, fullPage: Boolean(s.full) && !s.then })
}

test.describe('theme screenshots', () => {
  test.skip(!OUT, 'set SHOTS=<folder> to capture')

  for (const theme of THEMES) {
    for (const s of SHOTS) {
      test(`${s.name} · ${theme}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
        await installMock(context, s.role, 'en', { theme })
        await capture(await context.newPage(), s, `${theme}-${s.name}-en`)
        await context.close()
      })
    }
  }

  for (const lang of ['ru', 'uz'] as const) {
    for (const s of SHOTS.filter((x) => x.name === 'dashboard' || x.name === 'premium-tab')) {
      test(`${s.name} · ${lang} · large`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
        await installMock(context, s.role, lang, { textSize: 'large' })
        const page = await context.newPage()
        // the RU / UZ names of the step-in actions are not needed: these two screens open ready
        await capture(page, s, `grey-${s.name}-${lang}-large`)
        await context.close()
      })
    }
  }
})
