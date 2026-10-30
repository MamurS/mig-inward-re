/**
 * The search bar's record: suggestions open over the register in each theme
 * and text size (EN), chips for an OR query, the help popover, and RU / UZ.
 * Run: SHOTS=docs/search-bar/screenshots npx playwright test screenshots-search
 * Skipped unless SHOTS names an output folder.
 */
import { test, type Page } from '@playwright/test'
import { installMock } from './support/mockSupabase'

const OUT = process.env.SHOTS
const Q = 'Silk Road Underwriting Agency, bound; caspian, -declined, premium>10k'

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

test.describe('search bar screenshots', () => {
  test.skip(!OUT, 'set SHOTS=<folder> to capture')

  for (const theme of ['grey', 'blue', 'green', 'orange'] as const) {
    for (const textSize of ['normal', 'large'] as const) {
      test(`${theme} · ${textSize}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
        await installMock(context, 'underwriter', 'en', { theme, textSize })
        const page = await context.newPage()
        await page.goto(`/submissions?q=${encodeURIComponent(Q)}`)
        await page.locator('main tbody tr').first().waitFor()
        await settle(page)
        await page.screenshot({ path: `${OUT}/${theme}-${textSize}-chips.jpg`, type: 'jpeg', quality: 82 })
        await page.getByRole('combobox').click()
        await page.keyboard.press('End')
        await page.keyboard.type(', mga:s')
        await settle(page)
        await page.screenshot({ path: `${OUT}/${theme}-${textSize}-suggestions.jpg`, type: 'jpeg', quality: 82 })
        await context.close()
      })
    }
  }

  test('help popover', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    await installMock(context, 'underwriter', 'en')
    const page = await context.newPage()
    await page.goto('/submissions')
    await page.locator('main tbody tr').first().waitFor()
    await page.getByRole('combobox').click()
    await page.getByRole('button', { name: 'Syntax help' }).click()
    await settle(page)
    await page.screenshot({ path: `${OUT}/help-en.jpg`, type: 'jpeg', quality: 82 })
    await context.close()
  })

  for (const [lang, q] of [['ru', 'связан, валюта:usd; просрочено'], ['uz', 'holat:bog‘langan; kechikkan, -mamlakat:Oʻzbekiston']] as const) {
    test(`chips · ${lang}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
      await installMock(context, 'underwriter', lang, { textSize: 'large' })
      const page = await context.newPage()
      await page.goto(`/submissions?q=${encodeURIComponent(q)}`)
      await page.locator('main [data-chip]').first().waitFor()
      await settle(page)
      await page.screenshot({ path: `${OUT}/chips-${lang}-large.jpg`, type: 'jpeg', quality: 82 })
      await context.close()
    })
  }
})
