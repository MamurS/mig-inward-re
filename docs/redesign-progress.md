# Redesign progress (October 2026 UX/UI research)

Resume with: **"Continue the redesign from docs/redesign-progress.md"**.

Branch `claude/mga-inward-reinsurance-phase-0-1-otvuzf`, draft PR
MamurS/mig-inward-re#3. One commit per phase (`redesign: phase N — …`), push
after each; phase N+1 starts only when every phase-N check passes. Visual and
interaction only — no business logic, database, RLS or permission changes.
TCI-only items (credit grades, client portal, risk report) are out of scope.

Inputs: `docs/design-research-2026-10.md` (research), `DESIGN.md` (system),
`docs/colour-audit-2026-10.md`. TCI ERP's palette code was the starting point
(`src/design/oklch.ts`, ramp solver).

## Checks (all must pass before a phase commit)

```bash
npm run build
```

```bash
npm test
```

```bash
npx playwright test layout-stability
```

Screenshots (offline mock data, no Supabase): `SHOTS=docs/redesign/screenshots/after npx playwright test screenshots`.
The mock harness is `e2e/support/mockSupabase.ts` + `fixtures.ts`.

## Phase 1 — foundations ✅

- [x] OKLCH ramps (slate, navy brand, sky, success, warning, danger, info, violet, teal, magenta), canvas, roles
- [x] Pairing rule proven (5 steps text, 4 steps icons)
- [x] Status scale (7) and ageing scale (0–30 / 31–60 / 61–90 / 90+)
- [x] Categorical (8) and sequential (9) chart colours
- [x] Type scale 12/13/14/16/20/28/36, Inter + PT Sans Narrow display, tabular numbers
- [x] 4 px spacing rules, radii, 2 shadows, motion tokens 70/110/150/240/400, reduced motion
- [x] Class migration across all screens (no raw Tailwind palette colours, no off-scale sizes)
- [x] Contrast test, scale test, tokens-sync test (vitest)
- [x] Layout-stability test (7 screens × EN/RU/UZ; fixed: wide tables pushed pages sideways — `minmax(0,1fr)` columns)
- [x] UZ locale: oʻ / gʻ (U+02BB) and ’ (U+2019)
- [x] `/admin/tokens` preview page (admin only)
- [x] `DESIGN.md`, colour audit

## Phase 2 — components ⏳

- [ ] Table v2: density 40/48/56 remembered per user, sticky header, frozen first column, column show/hide, hover row actions, bulk bar, search highlight
- [ ] Quick-view side panel (register, agenda, counterparties)
- [ ] KPI card: delta + sparkline, clickable
- [ ] Unified badge (tinted; solid only for 90+), human-scale amounts with full-value tooltip
- [ ] Empty states with pictograms, skeleton rows, inline success check
- [ ] Command palette ⌘K / Ctrl K
- [ ] Forms: labels above, segmented controls, validate on blur, outcome-named buttons, sticky footer
- [ ] Side panels instead of modals

## Phase 3 — signature screens ⏳

- [ ] Dashboard, Submissions register, Submission detail, Submission form, Agenda, Counterparty page, Login (branded split screen, owner-photo slot)
- [ ] Tone guide, 10 strings per language, in `DESIGN.md`
- [ ] After screenshots EN/RU/UZ (`docs/redesign/screenshots/after`), incl. token page
- [ ] Final report: per phase changes, commits, checks; palette; audit; decisions + how to reverse

## Decisions so far (and how to reverse)

| # | decision | reverse by |
|---|---|---|
| 1 | Brand ramp named `navy` (TCI calls it `accent`) because shadcn's `accent` is the hover-surface role | rename in `RAMP_SPECS`, re-run `npm run design:tokens` |
| 2 | Warm neutrals (hue 70) instead of shadcn's cool grey | `RAMP_SPECS.slate.hue` |
| 3 | Light theme only; dark theme deferred until it passes the contrast test | add a `.dark` role map in `roleTokens()` |
| 4 | Display face PT Sans Narrow (Cyrillic + U+02BB coverage) for titles/KPIs only | `FONTS.display`, `font-display-bold` utility |
| 5 | Status hues on the funnel order (blue → violet → amber → orange → green; red, grey) | `STATUS_SPECS` |
| 6 | Ageing yellow → red; only 90+ solid | `AGING_SPECS`, badge component |
| 7 | UZ apostrophes converted to U+02BB / U+2019 | revert `src/locales/uz.json` |
| 8 | Excel export header fill `#E8EDF5` left as is (file, not screen) | `ExportButton.tsx` |
| 9 | Flexible grid columns use `minmax(0,1fr)` | the four `grid-cols-[…]` classes |
