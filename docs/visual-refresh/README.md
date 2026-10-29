# Visual refresh — light sidebar, colour themes, larger type

Visual only. One database change, approved: `profiles.ui_theme` and
`profiles.ui_text_size` (migration `20261029122833_profile_appearance.sql`).
No business logic, RLS or permission changes.

## What changed

- **Sidebar.** Light and frosted: a translucent tint with a backdrop blur, a hairline right border and dark text. The active item is an accent-tinted pill. A solid fallback is used where the blur isn't supported. Navy now appears only in the logo chip and on the login panel.
- **Four themes.** Grey (the default, with a blue accent), Blue, Green and Orange. Users choose one under user menu → Appearance; it is saved on their profile and applied before first paint, so there is no flash. Themes are CSS-variable sets, so no component knows which theme is active. Status and ageing colours are the same in every theme. All four themes are shown, with measured contrast, on `/admin/tokens`.
- **Type.**
  - Sizes: body and form text 15 px, table cells 14, labels 13, minimum 12, section titles 18, page titles 28, KPI figures 34.
  - Text size Large moves every size up one step.
- **Polish.**
  - Page padding 32 px and card padding 24 px.
  - Inputs and buttons are 40 px tall with a 10 px radius.
  - Page headers show quiet breadcrumbs.
  - KPI cards have an accent icon chip.
  - Tables have no header bar, hairline rows and about 48 px rows.
  - Transitions take 150 ms; with reduced motion they collapse.
- **Layout.**
  - The submission tabs now span the full content width, so the Premium tab no longer sits in a narrow column.
  - On the Premium tab, the `#` column and the row actions are sticky, so actions are never clipped.
  - Tab lists and card headers wrap instead of pushing the page sideways.

## Checks

| check | result |
|---|---|
| contrast (`contrast.test.ts`), per theme | 4 × green: text ≥ 4.5 : 1, icons/large ≥ 3 : 1 |
| scale guard (`scale.test.ts`) | green |
| layout stability, 7 screens × EN/RU/UZ | green |
| `appearance.spec.ts` | theme switch moves nothing (± 0.5 px); choice saved and back on reload; Large paints large from first paint; Large text × 7 screens × EN/RU/UZ (orange theme, 1280 px): no sideways page scroll, nav labels fit or truncate with a tooltip; Premium row actions inside their box |
| premium, components, feedback | green |

## Screenshots

`screenshots/` — `<theme>-<screen>-en.jpg` for the 4 themes × Dashboard, register,
submission detail, submission form, Premium tab and schedule editor; plus
`grey-dashboard-{ru,uz}-large.jpg` and `grey-premium-tab-{ru,uz}-large.jpg`.
Regenerate with `SHOTS=docs/visual-refresh/screenshots npx playwright test screenshots-themes`.
