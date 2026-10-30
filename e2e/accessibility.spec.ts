/**
 * Part E — accessibility: axe-core (WCAG 2.1 A and AA rules) on every main
 * page and form, in the default theme and in the darkest one. Any violation
 * fails with the rule, the impact and the first elements it found.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import type { FixtureRole } from './support/fixtures'

const PAGES: { name: string; path: string; role: FixtureRole; ready: string }[] = [
  { name: 'dashboard', path: '/dashboard', role: 'management', ready: '[data-premium-dashboard]' },
  { name: 'register', path: '/submissions', role: 'underwriter', ready: 'main tbody tr' },
  { name: 'new submission', path: '/submissions/new', role: 'underwriter', ready: 'main form' },
  { name: 'submission', path: '/submissions/30000000-0000-4000-8000-000000000002', role: 'underwriter', ready: 'main h1' },
  { name: 'edit submission', path: '/submissions/30000000-0000-4000-8000-000000000014/edit', role: 'underwriter', ready: 'main form' },
  { name: 'counterparties', path: '/counterparties', role: 'underwriter', ready: 'main tbody tr' },
  { name: 'counterparty', path: '/counterparties/20000000-0000-4000-8000-000000000001', role: 'finance', ready: '[data-counterparty-premium] dl' },
  { name: 'receivables', path: '/receivables', role: 'finance', ready: 'main h1' },
  { name: 'receipts', path: '/receipts', role: 'finance', ready: 'main h1' },
  { name: 'agenda', path: '/agenda', role: 'finance', ready: 'main h1' },
  { name: 'claims', path: '/claims', role: 'claims', ready: 'main tbody tr' },
  { name: 'claim', path: '/claims/80000000-0000-4000-8000-000000000001', role: 'claims', ready: '[data-claim-header]' },
  { name: 'binders', path: '/binders', role: 'underwriter', ready: 'main tbody tr' },
  { name: 'binder', path: '/binders/b1000000-0000-4000-8000-000000000001', role: 'underwriter', ready: '[data-periods-grid]' },
  { name: 'admin users', path: '/admin', role: 'admin', ready: 'main h1' },
  { name: 'admin reference', path: '/admin?tab=reference', role: 'admin', ready: 'main tbody tr' },
  { name: 'admin FX', path: '/admin?tab=fx', role: 'admin', ready: 'main h1' },
  { name: 'admin jobs', path: '/admin?tab=jobs', role: 'admin', ready: 'main h1' },
  { name: 'admin settings', path: '/admin?tab=settings', role: 'admin', ready: 'main h1' },
  { name: 'admin AI', path: '/admin?tab=ai', role: 'admin', ready: '[data-ai-admin]' },
  { name: 'admin demo', path: '/admin?tab=demo', role: 'admin', ready: '[data-demo-counts]' },
]

async function violations(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.recharts-wrapper').analyze()
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
}

for (const theme of ['grey', 'blue'] as const) {
  for (const p of PAGES) {
    test(`${p.name} · ${theme}`, async ({ page }) => {
      await installMock(page.context(), p.role, 'en', { theme })
      await page.goto(p.path)
      await page.locator(p.ready).first().waitFor()
      await page.waitForLoadState('networkidle')
      expect(await violations(page)).toEqual([])
    })
  }
}

test('login screen', async ({ page }) => {
  await installMock(page.context(), null, 'en')
  await page.goto('/login')
  await page.locator('form').first().waitFor()
  expect(await violations(page)).toEqual([])
})
