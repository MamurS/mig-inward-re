/**
 * Contrast in all four themes, on what is actually painted: axe's
 * color-contrast rule on the main pages, and the sidebar measured by hand —
 * it is translucent (the theme's tint over the page and its soft accent wash),
 * which axe can only mark «incomplete». Every nav label, the active pill and
 * the brand's subtitle must reach 4.5 : 1 over each thing that can show
 * through: the canvas, white and the accent wash.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { installMock } from './support/mockSupabase'
import type { FixtureRole } from './support/fixtures'

const THEMES = ['grey', 'blue', 'green', 'orange'] as const

const PAGES: { name: string; path: string; role: FixtureRole; ready: string }[] = [
  { name: 'dashboard', path: '/dashboard', role: 'management', ready: '[data-premium-dashboard]' },
  { name: 'register', path: '/submissions', role: 'underwriter', ready: 'main tbody tr' },
  { name: 'submission', path: '/submissions/30000000-0000-4000-8000-000000000002', role: 'underwriter', ready: 'main h1' },
  { name: 'receivables', path: '/receivables', role: 'finance', ready: 'main h1' },
  { name: 'claims', path: '/claims', role: 'claims', ready: 'main tbody tr' },
  { name: 'admin FX', path: '/admin?tab=fx', role: 'admin', ready: 'main tbody tr' },
]

for (const theme of THEMES) {
  for (const p of PAGES) {
    test(`color contrast · ${p.name} · ${theme}`, async ({ page }) => {
      await installMock(page.context(), p.role, 'en', { theme })
      await page.goto(p.path)
      await page.locator(p.ready).first().waitFor()
      await page.waitForLoadState('networkidle')
      const r = await new AxeBuilder({ page }).withRules(['color-contrast']).exclude('.recharts-wrapper').analyze()
      expect(r.violations.flatMap((v) => v.nodes.slice(0, 5).map((n) => `${n.target.join(' ')}: ${n.failureSummary}`))).toEqual([])
    })
  }

  for (const textSize of ['normal', 'large'] as const) {
    test(`sidebar: nav text, active pill and subtitle ≥ 4.5 : 1 · ${theme} · ${textSize}`, async ({ page }) => {
      await installMock(page.context(), 'admin', 'ru', { theme, textSize })
      await page.goto('/submissions')
      await page.locator('aside nav a[aria-current="page"]').waitFor()
      const report = await page.evaluate(() => {
        // any CSS colour → [r, g, b, a] (0–255, a 0–1), through a canvas
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
        const rgba = (css: string): number[] => {
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = css
          ctx.fillRect(0, 0, 1, 1)
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
          return [r, g, b, a / 255]
        }
        const over = (top: number[], under: number[]) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1)
        const lum = (c: number[]) => {
          const [r, g, b] = c.slice(0, 3).map((v) => {
            const s = v / 255
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        const ratio = (a: number[], b: number[]) => {
          const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
          return (x + 0.05) / (y + 0.05)
        }
        const root = getComputedStyle(document.documentElement)
        const under = ['--color-canvas', '--color-white', '--color-brand-100'].map((v) => rgba(root.getPropertyValue(v)))
        const aside = document.querySelector('aside.glass-sidebar')!
        const sidebar = rgba(getComputedStyle(aside).backgroundColor)
        const out: { text: string; worst: number; active: boolean }[] = []
        const texts = [...aside.querySelectorAll('nav a span:not([title]), [data-brand] div')] as HTMLElement[]
        for (const el of texts) {
          if (!el.textContent?.trim()) continue
          const link = el.closest('a')
          const pill = link ? rgba(getComputedStyle(link).backgroundColor) : [0, 0, 0, 0]
          const fg = rgba(getComputedStyle(el).color)
          const worst = Math.min(...under.map((u) => ratio(over(fg, over(pill, over(sidebar, u))), over(pill, over(sidebar, u)))))
          out.push({ text: el.textContent.trim(), worst: Math.round(worst * 100) / 100, active: link?.getAttribute('aria-current') === 'page' })
        }
        return { out, tinted: sidebar[0] !== sidebar[1] || sidebar[1] !== sidebar[2], pill: getComputedStyle(document.querySelector('aside nav a[aria-current="page"]')!).backgroundColor }
      })
      expect(report.out.length).toBeGreaterThan(5)
      expect(report.out.filter((r) => r.active)).toHaveLength(1)
      expect(report.out.filter((r) => r.worst < 4.5)).toEqual([])
      // the sidebar carries the theme's tint (not plain white or grey), and so does the active pill
      expect(report.tinted).toBe(true)
      expect(report.pill).not.toMatch(/rgba?\(0, 0, 0, 0\)|transparent/)
    })
  }
}
