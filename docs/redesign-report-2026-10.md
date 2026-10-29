# Redesign report — October 2026 UX/UI research

Branch `claude/mga-inward-reinsurance-phase-0-1-otvuzf`, PR MamurS/mig-inward-re#3.
Research: `docs/design-research-2026-10.md`. System: `DESIGN.md`. Audit:
`docs/colour-audit-2026-10.md`. Progress log: `docs/redesign-progress.md`.

**Scope held:** visual and interaction only — no change to business logic,
database, migrations, RLS, permissions or Supabase functions. Every data read
added (palette search, agenda amounts, quick views) goes through views the
screens already read (`submissions_v`, `follow_ups_v`, `counterparties`).
TCI-only items (credit grades, client portal, risk report) left out.

## Phase 1 — foundations · `490a7c0`

**What changed**

- Colour system rebuilt in OKLCH (`src/design/palette.ts` → generated
  `src/design/tokens.css`): 10 ramps of equal luminance per step, so
  contrast follows the step distance (text ≥ 5 steps, icons ≥ 4 steps).
  Warm neutrals; navy brand reserved for the sidebar / primary; sky secondary
  (focus, links); success / warning / danger / info; violet / teal / magenta
  for data only.
- Domain scales: submission status (7 hues on the funnel order) and overdue
  ageing 0–30 / 31–60 / 61–90 / 90+ (yellow → red, 90+ solid); categorical
  (8) and sequential (9) chart sets.
- Type: 12 / 13 / 14 / 16 / 20 / 28 / 36 px, three weights (400/500/600; 700
  only with the display face), Inter Variable + PT Sans Narrow display for
  titles and KPI figures, tabular numbers app-wide.
- 4 px spacing (no half steps), 4 radii, 2 shadows, Carbon motion tokens
  70 / 110 / 150 ms and 240 / 400 ms with easings; reduced motion respected.
- Every screen migrated to the tokens; UZ locale switched to oʻ / gʻ (U+02BB)
  and ’ (U+2019); admin-only `/admin/tokens` preview page; `DESIGN.md`;
  colour audit.

**Checks:** `npm run build` ✓ · vitest 6/6 (tokens in sync, scale, contrast) ✓
· layout stability 21/21 (7 screens × EN/RU/UZ) ✓. The layout test caught
pages pushed sideways by wide tables (`1fr` grid columns) — fixed with
`minmax(0,1fr)`.

## Phase 2 — components · `c0a2ae0`

**What changed**

- Table v2 (`DataTable`): density 40 / 48 / 56 px remembered per user,
  sticky header, frozen first column, column show / hide with reset, row
  actions on hover, floating bulk bar (export selected), search highlight,
  skeleton rows, empty state — register, counterparties list, counterparty
  page.
- Quick-view side panels (register, agenda, counterparties); every task
  dialog opens as a right side panel with a pinned footer.
- KPI card (delta vs a stated baseline, sparkline, click-through); one tinted
  badge (solid only for 90+ / counts); `AgingBadge`; `Amount` at human scale
  with the exact value in a tooltip; empty states with own pictograms;
  skeletons; inline «Saved ✓»; segmented controls.
- Command palette ⌘K / Ctrl K and a header search button.
- Forms: labels above, validate on blur, outcome-named buttons, sticky
  footer with form state.

**Checks:** build ✓ · vitest 8/8 ✓ · e2e 31/31 (layout 21 + components 10) ✓.
Found and fixed on the way: `cn()` silently dropped custom type sizes next to
a text colour (tailwind-merge config + test) — this had shrunk some Phase 1
figures; the mock didn't expose `content-range`.

## Phase 3 — signature screens · the phase-3 commit on this branch

**What changed**

- **Dashboard:** greeting with the date; KPI row; the oldest unanswered offers
  as an action list with days waiting on the ageing scale, beside an ageing
  stacked bar; two charts (bound premium by month, the status funnel in
  status colours); hit ratio / by MGA / by line one tab away; readable axis
  text (slate-600).
- **Register:** status chips with colour dots, «More filters» fold with an
  active-count badge.
- **Submission detail:** insured as the title; summary card with the status
  stepper (dates reached, outcome shown in place) and the five key figures.
- **Submission form:** required-fields meter in the sticky footer.
- **Agenda:** tighter rows with aligned amount and due / owner columns,
  ageing badges, quick view, «All caught up» completion moment.
- **Counterparty page:** summary card (badges for open items, six figures,
  status-mix bar), submissions in table v2, contacts as quick facts, details
  edited in a side panel.
- **Login:** branded split screen; layered-arcs pattern by default; image slot
  `VITE_LOGIN_PHOTO` for the owner's own photography only (a ≥ 70 % navy veil keeps
  white text ≥ 6 : 1 even over a white photo).
- **Tone guide** with 10 reference strings per language (`DESIGN.md`).
- UZ dates written out in code («21-fev, 2026») — the browser printed «2026 M02 21».
- E2E now runs on a production build; new `feedback.spec.ts` times five
  actions.

**Checks:** build ✓ · vitest 8/8 ✓ · e2e 32/32, twice in a row (layout 21 +
components 10 + feedback 1) ✓. Found and fixed: density preference applied
one render late (keyed by profile instead of session) — a load-time shift.

**Feedback times (production build, ms; budget 100):**

| action | ms |
|---|---|
| ⌘K opens the palette | 31–56 |
| status chip toggles | 48–50 |
| row selected → bulk bar | 14–21 |
| quick view opens | 39–54 |
| agenda tab switches | 8–10 |

## Palette (OKLCH + hex)

Generated from `src/design/palette.ts`; the same tables live in `DESIGN.md`.

| ramp | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| slate | `#fafaf9`<br>`oklch(98.5% 0.001 106.4)` | `#f3f1ef`<br>`oklch(95.9% 0.003 67.8)` | `#e5e2de`<br>`oklch(91.4% 0.006 75.4)` | `#cdc8c2`<br>`oklch(83.5% 0.010 72.6)` | `#908b84`<br>`oklch(63.9% 0.012 76.6)` | `#746f68`<br>`oklch(54.4% 0.012 76.5)` | `#635d58`<br>`oklch(48.2% 0.011 62.4)` | `#504c47`<br>`oklch(41.9% 0.010 73.6)` | `#3e3a37`<br>`oklch(35.1% 0.008 59.4)` | `#23211e`<br>`oklch(24.9% 0.006 78.2)` |
| navy | `#f6fbff`<br>`oklch(98.5% 0.008 241.7)` | `#e9f3ff`<br>`oklch(96.0% 0.019 252.9)` | `#cce4ff`<br>`oklch(91.0% 0.045 251.4)` | `#9dcdff`<br>`oklch(83.2% 0.087 249.9)` | `#4690d7`<br>`oklch(63.8% 0.130 249.7)` | `#2772b7`<br>`oklch(54.1% 0.130 250.2)` | `#1b609e`<br>`oklch(48.0% 0.120 250.2)` | `#124f84`<br>`oklch(41.9% 0.106 249.9)` | `#0a3c68`<br>`oklch(35.0% 0.092 250.5)` | `#002240`<br>`oklch(24.7% 0.069 249.3)` |
| sky | `#f5fbff`<br>`oklch(98.5% 0.008 236.6)` | `#e2f5ff`<br>`oklch(95.9% 0.024 230.4)` | `#bfe8ff`<br>`oklch(90.9% 0.053 232.7)` | `#7bd3ff`<br>`oklch(82.8% 0.105 231.7)` | `#0095c9`<br>`oklch(62.9% 0.129 232.2)` | `#0078a2`<br>`oklch(53.8% 0.109 231.7)` | `#00658a`<br>`oklch(47.6% 0.098 232.4)` | `#005371`<br>`oklch(41.5% 0.084 231.4)` | `#004059`<br>`oklch(34.9% 0.072 232.3)` | `#002433`<br>`oklch(24.4% 0.049 230.6)` |
| success | `#effef3`<br>`oklch(98.3% 0.021 154.1)` | `#d6fbe1`<br>`oklch(95.5% 0.052 154.7)` | `#acf1c4`<br>`oklch(90.0% 0.093 155.5)` | `#73dd9c`<br>`oklch(81.7% 0.136 155.0)` | `#00a05b`<br>`oklch(62.0% 0.153 154.9)` | `#008048`<br>`oklch(52.7% 0.130 155.1)` | `#006c3c`<br>`oklch(46.7% 0.115 155.1)` | `#005830`<br>`oklch(40.4% 0.100 155.2)` | `#004624`<br>`oklch(34.6% 0.086 154.5)` | `#002712`<br>`oklch(24.0% 0.059 155.0)` |
| warning | `#fff9f4`<br>`oklch(98.5% 0.009 62.6)` | `#fff0df`<br>`oklch(96.2% 0.028 71.0)` | `#ffdcb6`<br>`oklch(91.4% 0.063 69.2)` | `#ffbb69`<br>`oklch(83.9% 0.126 69.8)` | `#c37c00`<br>`oklch(64.6% 0.140 70.0)` | `#9c6300`<br>`oklch(54.9% 0.118 70.6)` | `#855300`<br>`oklch(48.7% 0.106 69.9)` | `#6d4300`<br>`oklch(42.2% 0.092 69.7)` | `#553400`<br>`oklch(35.7% 0.077 70.8)` | `#311c00`<br>`oklch(24.8% 0.054 70.9)` |
| danger | `#fff9f8`<br>`oklch(98.6% 0.007 28.8)` | `#ffeeec`<br>`oklch(96.2% 0.019 25.6)` | `#ffdad4`<br>`oklch(91.8% 0.042 28.8)` | `#ffb6ad`<br>`oklch(84.2% 0.087 26.9)` | `#fe4741`<br>`oklch(66.4% 0.220 27.0)` | `#db1c22`<br>`oklch(57.0% 0.220 27.0)` | `#bd0916`<br>`oklch(50.5% 0.202 27.0)` | `#9d000e`<br>`oklch(43.8% 0.178 26.9)` | `#7e0008`<br>`oklch(37.3% 0.152 27.2)` | `#4b0003`<br>`oklch(26.0% 0.106 26.9)` |
| info | `#f8faff`<br>`oklch(98.5% 0.007 268.5)` | `#ebf3ff`<br>`oklch(96.2% 0.018 258.4)` | `#d2e3ff`<br>`oklch(91.2% 0.043 260.4)` | `#acc9ff`<br>`oklch(83.4% 0.083 262.7)` | `#5589ed`<br>`oklch(64.2% 0.160 262.2)` | `#396ccd`<br>`oklch(54.8% 0.160 261.8)` | `#2e5ab1`<br>`oklch(48.5% 0.147 262.2)` | `#234994`<br>`oklch(42.2% 0.131 262.2)` | `#193876`<br>`oklch(35.6% 0.113 262.3)` | `#061e4d`<br>`oklch(25.1% 0.092 261.7)` |
| violet | `#fbf9ff`<br>`oklch(98.5% 0.008 301.4)` | `#f4efff`<br>`oklch(96.1% 0.022 300.2)` | `#e8dcff`<br>`oklch(91.5% 0.049 301.1)` | `#d4bdff`<br>`oklch(84.0% 0.094 300.4)` | `#a274e8`<br>`oklch(65.5% 0.171 300.0)` | `#8657c8`<br>`oklch(56.2% 0.170 300.2)` | `#7248ad`<br>`oklch(49.9% 0.156 300.0)` | `#5e3990`<br>`oklch(43.3% 0.139 300.3)` | `#4a2b73`<br>`oklch(36.7% 0.120 300.4)` | `#2c124b`<br>`oklch(25.7% 0.100 300.3)` |
| teal | `#eefdfc`<br>`oklch(98.3% 0.016 192.1)` | `#d1f9f6`<br>`oklch(95.3% 0.041 190.9)` | `#a2f1eb`<br>`oklch(90.5% 0.078 189.8)` | `#5ddcd4`<br>`oklch(82.2% 0.113 189.5)` | `#009c97`<br>`oklch(62.5% 0.108 190.8)` | `#007d78`<br>`oklch(53.2% 0.092 189.9)` | `#006965`<br>`oklch(47.0% 0.081 190.2)` | `#005653`<br>`oklch(40.9% 0.070 190.7)` | `#004441`<br>`oklch(34.9% 0.060 189.8)` | `#002524`<br>`oklch(23.9% 0.041 192.1)` |
| magenta | `#fff9fc`<br>`oklch(98.8% 0.007 345.3)` | `#ffedf7`<br>`oklch(96.3% 0.023 342.9)` | `#ffd7ec`<br>`oklch(91.9% 0.052 345.2)` | `#ffb2dd`<br>`oklch(84.9% 0.104 345.0)` | `#dc5dab`<br>`oklch(66.2% 0.180 345.3)` | `#bb3e8e`<br>`oklch(56.6% 0.181 345.1)` | `#a1317a`<br>`oklch(50.4% 0.166 344.7)` | `#862564`<br>`oklch(43.8% 0.148 345.0)` | `#6a1b4e`<br>`oklch(37.0% 0.125 345.3)` | `#43042f`<br>`oklch(26.0% 0.103 345.0)` |


Canvas `#f8f6f5` `oklch(97.4% 0.003 48.7)`. Pairing: 5 steps worst 4.62 (canvas/slate-500), 4 steps worst 3.13 (canvas/navy-400).

### Submission status scale

| status | tint | line | solid | ink | deep | deep on tint | solid on white |
|---|---|---|---|---|---|---|---|
| received | `#ebf3ff` | `#d2e3ff` | `#5589ed` | `#2e5ab1` | `#234994` | 7.67 | 3.39 |
| under_review | `#f4efff` | `#e8dcff` | `#a274e8` | `#7248ad` | `#5e3990` | 7.56 | 3.39 |
| offered | `#fff0db` | `#ffdcae` | `#bd8000` | `#815500` | `#694500` | 7.64 | 3.36 |
| no_response | `#ffefe6` | `#ffdbc8` | `#e46600` | `#9c4400` | `#813600` | 7.62 | 3.39 |
| bound | `#d6fbe1` | `#acf1c4` | `#00a05b` | `#006c3c` | `#005830` | 7.69 | 3.40 |
| ntu | `#f5f1ee` | `#e8e1db` | `#938a7f` | `#655c53` | `#534b43` | 7.62 | 3.40 |
| declined | `#ffeeec` | `#ffdad4` | `#fe4741` | `#bd0916` | `#9d000e` | 7.66 | 3.39 |

### Overdue ageing scale

| bucket | tint | line | solid | ink | deep | deep on tint | white on ink |
|---|---|---|---|---|---|---|---|
| 0-30 | `#fdf1ce` | `#f6e19e` | `#a98800` | `#725c00` | `#5e4a00` | 7.60 | 6.47 |
| 31-60 | `#fff0df` | `#ffdcb6` | `#c37c00` | `#855300` | `#6d4300` | 7.66 | 6.49 |
| 61-90 | `#ffefe6` | `#ffdbc8` | `#e46600` | `#9c4400` | `#813600` | 7.62 | 6.48 |
| 90+ | `#ffeeec` | `#ffdad4` | `#fe4741` | `#bd0916` | `#9d000e` | 7.66 | 6.53 |

### Chart colours

data-1 `#4690d7` (3.37 : 1 on white) · data-2 `#c37c00` (3.39 : 1 on white) · data-3 `#009c97` (3.39 : 1 on white) · data-4 `#dc5dab` (3.39 : 1 on white) · data-5 `#0095c9` (3.42 : 1 on white) · data-6 `#00a05b` (3.40 : 1 on white) · data-7 `#a274e8` (3.39 : 1 on white) · data-8 `#fe4741` (3.39 : 1 on white)

## Colour audit

Full audit: `docs/colour-audit-2026-10.md`. Before: 26 raw Tailwind palette
classes picked per screen, received / NTU both grey, one failing pair (white
10 px text on red-500, 3.76 : 1) and one marginal (amber-600 icons, 3.19 : 1).
After: 0 raw palette classes, every class pair in `src` checked by
`contrast.test.ts` (≥ 4.5 : 1 text, ≥ 3 : 1 icons / large text), one hex
left on purpose (Excel export header fill — a file, not a screen).

## Decisions and how to reverse them

| # | decision | why (research) | reverse by |
|---|---|---|---|
| 1 | Brand ramp named `navy` (TCI: `accent`) | shadcn's `accent` is the hover-surface role | rename in `RAMP_SPECS`, `npm run design:tokens` |
| 2 | Warm neutrals (hue 70) | calm, warmer base; one temperature with the accents | `RAMP_SPECS.slate.hue` |
| 3 | Light theme only | dark ships only if it passes contrast — not built yet | add a `.dark` role map in `roleTokens()` |
| 4 | PT Sans Narrow display face, titles / KPIs only | condensed display voice; covers Cyrillic + U+02BB | `FONTS.display`, `font-display-bold` |
| 5 | Status hues on the funnel order | one colour per meaning | `STATUS_SPECS` |
| 6 | Ageing yellow → red; only 90+ solid | solid reserved for what must shout | `AGING_SPECS`, `Badge` `solid` |
| 7 | UZ apostrophes → U+02BB / U+2019 | correct Uzbek Latin glyphs | revert `src/locales/uz.json` |
| 8 | Excel header fill `#E8EDF5` kept | a file, not a screen | `ExportButton.tsx` |
| 9 | `minmax(0,1fr)` for flexible columns | no layout shift / sideways scroll | the `grid-cols-[…]` classes |
| 10 | Default table density 48 px | Carbon default; 40 / 56 offered | `usePref('table.density', …)` default |
| 11 | Per-user prefs in localStorage keyed by user id | visual-only brief: no DB change | move `usePref` to a profile column |
| 12 | All task dialogs → right side panels; `confirm()` kept for deletes | side panels over modals; confirmations stay short | `variant="center"` |
| 13 | Bulk action = export selected only | bulk status change would be business logic | add to `bulkActions` |
| 14 | KPI deltas vs the same stretch of the previous month / year; no delta on state counts | a delta needs a stated baseline; states have no history | KPI block in `DashboardPage` |
| 15 | Validation `onTouched` | validate on blur, then live | `mode` in `useForm` |
| 16 | In-place saves show «Saved ✓» instead of a toast | inline confirmation over toasts | `SavedCheck` → `toast.success` |
| 17 | Dashboard: action list first, two charts, the rest in tabs | «what needs me today» before «how are we doing»; at most two charts | restore the grid in `DashboardPage` |
| 18 | Funnel bars in status colours | status scale as the signature colour | `Cell` fill → `BAR` |
| 19 | Submission detail title = insured; ref in subtitle | humans scan names; ref stays visible | `PageHeader` title |
| 20 | Register filters fold behind «More filters» (auto-open when used) | lighter header, chips first | `showMore` in `SubmissionsPage` |
| 21 | Counterparty details edited in a side panel | the page reads first; edit on demand | inline the form again |
| 22 | Login: drawn pattern by default; photo only via `VITE_LOGIN_PHOTO` | owner's photos only, no stock | set / unset the env var |
| 23 | UZ dates formatted in code | browsers lack Uzbek month names | `formatDate` / `formatLongDate` |
| 24 | E2E on a production build | timings and behaviour as users get them | `webServer.command` in `playwright.config.ts` |
| 25 | Sidebar keeps navy-800 (not dimmed further) | brand reserved for the sidebar; contrast 10.8 : 1 | `roleTokens().sidebar` |

## Screenshots (before → after)

1440 × 900, offline mock data, reduced motion. «Before» = `main` at
`c1611c2`; the token page did not exist before.

| screen | lang | before | after |
|---|---|---|---|
| Dashboard | EN | [before](redesign/screenshots/before/dashboard-en.jpg) | [after](redesign/screenshots/after/dashboard-en.jpg) |
| Dashboard | RU | [before](redesign/screenshots/before/dashboard-ru.jpg) | [after](redesign/screenshots/after/dashboard-ru.jpg) |
| Dashboard | UZ | [before](redesign/screenshots/before/dashboard-uz.jpg) | [after](redesign/screenshots/after/dashboard-uz.jpg) |
| Submissions register | EN | [before](redesign/screenshots/before/register-en.jpg) | [after](redesign/screenshots/after/register-en.jpg) |
| Submissions register | RU | [before](redesign/screenshots/before/register-ru.jpg) | [after](redesign/screenshots/after/register-ru.jpg) |
| Submissions register | UZ | [before](redesign/screenshots/before/register-uz.jpg) | [after](redesign/screenshots/after/register-uz.jpg) |
| Submission detail | EN | [before](redesign/screenshots/before/submission-detail-en.jpg) | [after](redesign/screenshots/after/submission-detail-en.jpg) |
| Submission detail | RU | [before](redesign/screenshots/before/submission-detail-ru.jpg) | [after](redesign/screenshots/after/submission-detail-ru.jpg) |
| Submission detail | UZ | [before](redesign/screenshots/before/submission-detail-uz.jpg) | [after](redesign/screenshots/after/submission-detail-uz.jpg) |
| Submission form | EN | [before](redesign/screenshots/before/submission-form-en.jpg) | [after](redesign/screenshots/after/submission-form-en.jpg) |
| Submission form | RU | [before](redesign/screenshots/before/submission-form-ru.jpg) | [after](redesign/screenshots/after/submission-form-ru.jpg) |
| Submission form | UZ | [before](redesign/screenshots/before/submission-form-uz.jpg) | [after](redesign/screenshots/after/submission-form-uz.jpg) |
| Agenda | EN | [before](redesign/screenshots/before/agenda-en.jpg) | [after](redesign/screenshots/after/agenda-en.jpg) |
| Agenda | RU | [before](redesign/screenshots/before/agenda-ru.jpg) | [after](redesign/screenshots/after/agenda-ru.jpg) |
| Agenda | UZ | [before](redesign/screenshots/before/agenda-uz.jpg) | [after](redesign/screenshots/after/agenda-uz.jpg) |
| Counterparty page | EN | [before](redesign/screenshots/before/counterparty-en.jpg) | [after](redesign/screenshots/after/counterparty-en.jpg) |
| Counterparty page | RU | [before](redesign/screenshots/before/counterparty-ru.jpg) | [after](redesign/screenshots/after/counterparty-ru.jpg) |
| Counterparty page | UZ | [before](redesign/screenshots/before/counterparty-uz.jpg) | [after](redesign/screenshots/after/counterparty-uz.jpg) |
| Login | EN | [before](redesign/screenshots/before/login-en.jpg) | [after](redesign/screenshots/after/login-en.jpg) |
| Login | RU | [before](redesign/screenshots/before/login-ru.jpg) | [after](redesign/screenshots/after/login-ru.jpg) |
| Login | UZ | [before](redesign/screenshots/before/login-uz.jpg) | [after](redesign/screenshots/after/login-uz.jpg) |
| Token page (`/admin/tokens`) | EN | — (new page) | [after](redesign/screenshots/after/tokens-en.jpg) |
| Token page (`/admin/tokens`) | RU | — (new page) | [after](redesign/screenshots/after/tokens-ru.jpg) |
| Token page (`/admin/tokens`) | UZ | — (new page) | [after](redesign/screenshots/after/tokens-uz.jpg) |
