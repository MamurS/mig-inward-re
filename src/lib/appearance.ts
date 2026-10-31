/**
 * Appearance — colour theme and text size, saved on the user's profile
 * (profiles.ui_theme / ui_text_size). Applied as attributes on <html>
 * (`data-theme`, `data-text-size`); the CSS variable sets in tokens.css do the
 * rest, so components never know which theme is active. The last choice is
 * also cached in localStorage so index.html applies it before the first paint.
 */
export const THEMES = ['grey', 'blue', 'green', 'orange'] as const
export const TEXT_SIZES = ['normal', 'large'] as const
export type Theme = (typeof THEMES)[number]
export type TextSize = (typeof TEXT_SIZES)[number]
export type Appearance = { theme: Theme; textSize: TextSize }

export const DEFAULT_APPEARANCE: Appearance = { theme: 'grey', textSize: 'normal' }
const CACHE_KEY = 'mig.appearance'

export function normalizeAppearance(theme: unknown, textSize: unknown): Appearance {
  return {
    theme: THEMES.includes(theme as Theme) ? (theme as Theme) : DEFAULT_APPEARANCE.theme,
    textSize: TEXT_SIZES.includes(textSize as TextSize) ? (textSize as TextSize) : DEFAULT_APPEARANCE.textSize,
  }
}

/** Sets the attributes; `fade` lets colours change over 150 ms (never sizes). */
export function applyAppearance(a: Appearance, { fade = false }: { fade?: boolean } = {}) {
  const root = document.documentElement
  if (root.dataset.theme === a.theme && root.dataset.textSize === a.textSize) return
  if (fade) {
    root.classList.add('theme-fade')
    window.setTimeout(() => root.classList.remove('theme-fade'), 200)
  }
  root.dataset.theme = a.theme
  root.dataset.textSize = a.textSize
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(a))
  } catch {
    /* storage unavailable: the profile still has it */
  }
}

/** Chart labels are drawn in SVG (no CSS size tokens): the caption size in px, one step up with Large text. */
export function chartFontSize(): number {
  return typeof document !== 'undefined' && document.documentElement.dataset.textSize === 'large' ? 14 : 12
}
