/**
 * Screenshots of the key screens in EN / RU / UZ (the redesign's before /
 * after record). Run: SHOTS=docs/redesign/screenshots/after npx playwright test screenshots
 * Skipped unless SHOTS names an output folder.
 */
import { test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import type { FixtureRole } from './support/fixtures'

const OUT = process.env.SHOTS
const LANGS = ['en', 'ru', 'uz'] as const

const SCREENS: { name: string; path: string; role: FixtureRole | null; ready: string; full?: boolean }[] = [
  { name: 'dashboard', path: '/dashboard', role: 'management', ready: 'main h1' },
  { name: 'register', path: '/submissions', role: 'underwriter', ready: 'main tbody tr' },
  { name: 'submission-detail', path: '/submissions/30000000-0000-4000-8000-000000000002', role: 'underwriter', ready: 'main h1' },
  { name: 'submission-form', path: '/submissions/30000000-0000-4000-8000-000000000014/edit', role: 'underwriter', ready: 'main form' },
  { name: 'agenda', path: '/agenda', role: 'underwriter', ready: 'main h1' },
  { name: 'counterparty', path: '/counterparties/20000000-0000-4000-8000-000000000001', role: 'underwriter', ready: 'main h1' },
  { name: 'login', path: '/login', role: null, ready: '#email' },
  { name: 'tokens', path: '/admin/tokens', role: 'admin', ready: 'main h1' },
]

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

test.describe('screenshots', () => {
  test.skip(!OUT, 'set SHOTS=<folder> to capture')
  for (const lang of LANGS) {
    for (const s of SCREENS) {
      test(`${s.name} · ${lang}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
        await installMock(context, s.role, lang)
        const page = await context.newPage()
        await page.goto(s.path)
        const ok = await page.locator(s.ready).first().waitFor({ timeout: 15_000 }).then(() => true).catch(() => false)
        if (!ok) test.skip(true, `${s.path} not available in this version`)
        await settle(page)
        await page.screenshot({ path: `${OUT}/${s.name}-${lang}.jpg`, type: 'jpeg', quality: 80, fullPage: true })
        await context.close()
      })
    }
  }
})
