/**
 * Feedback under 100 ms (docs/design-research-2026-10.md, «Response-time
 * budget»): five representative actions, timed inside the page from the
 * click to the first frame that shows the result.
 */
import { expect, test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'

const BUDGET_MS = 100

/** Clicks `target` (or presses keys) in the page and resolves with the ms until `done()` is true on a painted frame. */
async function timeTo(page: Page, act: { click?: string; key?: { key: string; ctrl?: boolean } }, done: string): Promise<number> {
  return page.evaluate(
    ([click, key, doneSrc]) =>
      new Promise<number>((resolve, reject) => {
        const isDone = new Function(`return (${doneSrc as string})`) as () => boolean
        const t0 = performance.now()
        if (click) {
          // The full sequence a real click makes (Radix tabs and menus act on pointer-down)
          const el = document.querySelector(click as string) as HTMLElement
          const opts = { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true }
          el.dispatchEvent(new PointerEvent('pointerdown', opts))
          el.dispatchEvent(new MouseEvent('mousedown', opts))
          el.dispatchEvent(new PointerEvent('pointerup', opts))
          el.dispatchEvent(new MouseEvent('mouseup', opts))
          el.click()
        }
        if (key) {
          const k = key as { key: string; ctrl?: boolean }
          window.dispatchEvent(new KeyboardEvent('keydown', { key: k.key, ctrlKey: k.ctrl, bubbles: true }))
        }
        const tick = () => {
          if (isDone()) return resolve(performance.now() - t0)
          if (performance.now() - t0 > 2000) return reject(new Error('never happened'))
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    [act.click ?? null, act.key ?? null, done] as const,
  )
}

test('five actions answer within 100 ms', async ({ browser }) => {
  const context = await browser.newContext()
  await installMock(context, 'underwriter', 'en')
  const page = await context.newPage()
  await page.goto('/submissions')
  await page.locator('main tbody tr').first().waitFor()
  await page.waitForLoadState('networkidle')

  const results: Record<string, number> = {}

  // 1. The search suggestions open (Ctrl K)
  results.search = await timeTo(page, { key: { key: 'k', ctrl: true } }, `Boolean(document.querySelector('#search-suggestions'))`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  // 2. A search chip is removed (gone before the data reloads)
  await page.goto('/submissions?q=bound')
  await page.locator('main [data-chip]').first().waitFor()
  await page.waitForLoadState('networkidle')
  results.chip = await timeTo(page, { click: 'main [data-chip] button' }, `!document.querySelector('main [data-chip]')`)
  await page.waitForLoadState('networkidle')

  // 3. A row is selected and the bulk bar appears
  results.selectRow = await timeTo(page, { click: 'main tbody input[type="checkbox"]' }, `Boolean(document.querySelector('[role="toolbar"]'))`)

  // 4. Quick view opens
  results.quickView = await timeTo(page, { click: 'main tbody button[aria-label="Quick view"]' }, `Boolean(document.querySelector('[role="dialog"]'))`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // 5. Agenda tab switches
  await page.goto('/agenda')
  await page.locator('main h1').waitFor()
  await page.waitForLoadState('networkidle')
  results.tab = await timeTo(page, { click: 'main [role="tab"]:nth-child(2)' }, `document.querySelector('main [role="tab"]:nth-child(2)').getAttribute('data-state') === 'active'`)

  console.log('feedback ms', JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, Math.round(v)]))))
  for (const [name, ms] of Object.entries(results)) expect(ms, name).toBeLessThan(BUDGET_MS)
  await context.close()
})
