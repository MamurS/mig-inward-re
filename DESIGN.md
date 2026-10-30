# DESIGN.md — MIG Inward Re design system

The single reference for how screens look and move. The values live in code:
`src/design/palette.ts` is the source; `npm run design:tokens` writes
`src/design/tokens.css` (Tailwind v4 `@theme`), and a test fails if the two
drift apart. The live, admin-only preview is **Administration → `/admin/tokens`**.

Research basis: `docs/design-research-2026-10.md` (October 2026 UX/UI research).
Progress of the redesign: `docs/redesign-progress.md`. Colour audit:
`docs/colour-audit-2026-10.md`.

## Principles

1. **Calm by default, loud by exception.** Most of the screen is warm neutral;
   colour carries meaning (status, overdue, danger), never decoration.
2. **One colour per meaning.** A submission status or an overdue bucket has one
   fixed hue everywhere: badge, chart bar, dot.
3. **Numbers first.** Tabular figures everywhere; the display face only for
   titles and KPI figures.
4. **Nothing moves unless the user moved it.** No layout shift on hover,
   loading or focus; feedback within 100 ms; motion is off under
   `prefers-reduced-motion`.
5. **Three languages are first-class.** Every screen is checked in EN, RU and
   UZ (Latin, with oʻ / gʻ as U+02BB and the apostrophe as U+2019).

## Colour

### How the ramps are built

Ten steps per ramp (50 … 900), solved in OKLCH so that **every ramp has the
same relative luminance at the same step** (`STEP_LUMINANCE` in
`palette.ts`). That makes contrast a property of the step distance, not of
the hue:

- **Pairing rule.** Text needs ≥ 5 steps between foreground and background
  (≥ 4.5 : 1); icons, borders that carry meaning and large text need ≥ 4
  steps (≥ 3 : 1). The test `src/design/contrast.test.ts` proves the worst
  pair of every ramp.
- **Ramps.** `slate` — warm neutrals (hue 70, chroma 0.012): text, borders,
  surfaces. `brand` — the theme accent (primary button, active nav, links,
  focus ring, selected rows, KPI chips, chart accent); it is one of four
  ramps, chosen by the colour theme. `navy` — the company colour, kept for the
  logo chip and the login panel only. `sky` — secondary: focus ring, links,
  informational highlights. `success`, `warning`, `danger`, `info` — feedback.
  `violet`, `teal`, `magenta` — only for data (charts, status scale).
- **Page background** is the theme's canvas tint (with a faint accent wash at
  the top); cards are white.
- **No dark theme** for now: a dark theme ships only once it passes the same
  contrast test.

### Colour themes and text size

Four light themes, chosen per user under user menu → **Appearance** and saved
on the profile (`profiles.ui_theme`, `ui_text_size`):

| theme | accent | page and sidebar tint |
|---|---|---|
| Grey (default) | blue | cool grey |
| Blue | blue | pale sky |
| Green | green | lime / salad |
| Orange | orange | peach |

- **Mechanics.** `palette.ts` → `THEMES` builds each theme's `brand` ramp on
  the same equal-luminance steps as every other ramp, so the pairing rule —
  and the contrast test — hold in every theme by construction. `tokens.css`
  holds the grey theme in `@theme` and one `:root[data-theme='…']` block per
  other theme re-mapping `--color-brand-*`, `primary`, `ring`, `link`,
  `canvas`, `sidebar*`, `data-1` and `seq-*`. Components only use roles and
  `brand-*` — **no component knows the theme**.
- **Fixed in every theme:** status and ageing colours, feedback colours,
  text and borders (slate).
- **Pastels are backgrounds only** (canvas, sidebar, `brand-50/100` tints);
  text on them uses steps ≥ 5 apart.
- **Text size.** Normal / Large; Large moves every `text-*` one step up
  (`:root[data-text-size='large']`). Only type changes — never layout tokens.
- **Applying.** `src/lib/appearance.ts` sets `data-theme` / `data-text-size`
  on `<html>`; the last choice is cached in `localStorage` (`mig.appearance`)
  and an inline script in `index.html` applies it before the first paint, so
  there is no flash. A theme change cross-fades colours for 150 ms
  (`theme-fade`); a size change is instant. Both respect reduced motion.
- **The admin token page** (`/admin/tokens`) shows all four themes with their
  ramps and measured contrast.

### Sidebar

Light and frosted: the theme's sidebar tint at 72 % behind
`backdrop-filter: saturate(1.4) blur(18px)`, a solid tint where that is not
supported (`glass-sidebar` in `index.css`), a hairline right border, no heavy
shadow. Dark text (`sidebar-foreground` slate-800, `sidebar-muted` slate-600),
20 px icons; the active item is a soft accent pill (`sidebar-accent` brand-100,
text brand-800, medium weight); hover is a gentle slate-100. No navy in the
sidebar except the logo chip.

### Roles (shadcn/ui vocabulary)

Components use role names (`bg-primary`, `text-muted-foreground`, …), which
point into the ramps (`roleTokens()` in `palette.ts`). Re-map a role there —
never in a component.

### Domain scales

**Submission status** — seven statuses, one hue each, ordered along the
funnel: received (blue) → under review (violet) → offered (amber) → no
response (orange) → bound (green); declined (red) and NTU (grey) end it. Each
status has `tint` (badge fill), `line` (badge border), `solid` (chart mark,
dot), `ink` and `deep` (text). Classes: `bg-status-<key>-tint
text-status-<key>-deep border-status-<key>-line`, solid `bg-status-<key>`
(`under_review` → `under-review`).

**Overdue ageing** — 0–30 / 31–60 / 61–90 / 90+ days, from yellow through
amber and orange to red. Badges are tinted; **only 90+ is solid** (white on
`aging-90plus-ink`). Classes: `aging-0to30`, `aging-31to60`, `aging-61to90`,
`aging-90plus` with `-tint/-line/-ink/-deep`.

**Charts** — categorical `data-1 … data-8` (all ≥ 3 : 1 on white, in an order
that keeps neighbours distinct), sequential `seq-1 … seq-9` (theme accent 100 … 900).

### Palette values (generated from `palette.ts`)

### Ramps

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

Canvas (no theme) `#f8f6f5`. Pairing across every ramp, every theme accent, canvas and sidebar: 5 steps worst 4.62 (canvas/slate-500), 4 steps worst 3.12 (canvas/brand(blue)-400).

### Themes

| theme | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | canvas | sidebar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| grey | `#f7fbff` | `#e9f3ff` | `#d0e4ff` | `#a4cbff` | `#468de4` | `#2770c4` | `#1c5eab` | `#134d8e` | `#0c3b71` | `#002047` | `#f5f7fa` | `#fafbfe` |
| blue | `#f6fbff` | `#e9f3ff` | `#cce5ff` | `#9dcdff` | `#3690e2` | `#0b72c2` | `#0061a8` | `#004e8a` | `#003d6d` | `#002240` | `#edf9ff` | `#f7fcff` |
| green | `#f1fdf3` | `#dbfade` | `#b7efbe` | `#88db94` | `#2ca04a` | `#008131` | `#006e29` | `#005920` | `#004517` | `#002809` | `#eefdd8` | `#f5ffe5` |
| orange | `#fff9f5` | `#ffeee6` | `#ffdac7` | `#ffb991` | `#df6a09` | `#b45300` | `#9a4600` | `#7f3800` | `#642b00` | `#3b1600` | `#fff5ee` | `#fffbf7` |

| theme | white on primary | link on white | active nav | sidebar muted text | muted text on canvas | ring on white |
|---|---|---|---|---|---|---|
| grey | 6.48 | 6.48 | 9.96 | 6.27 | 6.04 | 3.39 |
| blue | 6.41 | 6.41 | 9.92 | 6.28 | 6.05 | 3.36 |
| green | 6.44 | 6.44 | 10.06 | 6.28 | 6.08 | 3.37 |
| orange | 6.46 | 6.46 | 9.87 | 6.30 | 6.04 | 3.39 |

### Status scale

| status | tint | line | solid | ink | deep | deep on tint | solid on white |
|---|---|---|---|---|---|---|---|
| received | `#ebf3ff` | `#d2e3ff` | `#5589ed` | `#2e5ab1` | `#234994` | 7.67 | 3.39 |
| under_review | `#f4efff` | `#e8dcff` | `#a274e8` | `#7248ad` | `#5e3990` | 7.56 | 3.39 |
| offered | `#fff0db` | `#ffdcae` | `#bd8000` | `#815500` | `#694500` | 7.64 | 3.36 |
| no_response | `#ffefe6` | `#ffdbc8` | `#e46600` | `#9c4400` | `#813600` | 7.62 | 3.39 |
| bound | `#d6fbe1` | `#acf1c4` | `#00a05b` | `#006c3c` | `#005830` | 7.69 | 3.40 |
| ntu | `#f5f1ee` | `#e8e1db` | `#938a7f` | `#655c53` | `#534b43` | 7.62 | 3.40 |
| declined | `#ffeeec` | `#ffdad4` | `#fe4741` | `#bd0916` | `#9d000e` | 7.66 | 3.39 |

### Ageing scale

| bucket | tint | line | solid | ink | deep | deep on tint | white on ink |
|---|---|---|---|---|---|---|---|
| 0-30 | `#fdf1ce` | `#f6e19e` | `#a98800` | `#725c00` | `#5e4a00` | 7.60 | 6.47 |
| 31-60 | `#fff0df` | `#ffdcb6` | `#c37c00` | `#855300` | `#6d4300` | 7.66 | 6.49 |
| 61-90 | `#ffefe6` | `#ffdbc8` | `#e46600` | `#9c4400` | `#813600` | 7.62 | 6.48 |
| 90+ | `#ffeeec` | `#ffdad4` | `#fe4741` | `#bd0916` | `#9d000e` | 7.66 | 6.53 |

### Categorical

data-1 `#468de4` (3.39 : 1 on white) · data-2 `#c37c00` (3.39 : 1 on white) · data-3 `#009c97` (3.39 : 1 on white) · data-4 `#dc5dab` (3.39 : 1 on white) · data-5 `#0095c9` (3.42 : 1 on white) · data-6 `#00a05b` (3.40 : 1 on white) · data-7 `#a274e8` (3.39 : 1 on white) · data-8 `#fe4741` (3.39 : 1 on white) — data-1 follows the theme accent (grey shown).

### Roles (grey theme; the others re-map primary, ring, link, canvas and sidebar*)

| role | hex |
|---|---|
| background | `#ffffff` |
| foreground | `#23211e` |
| card | `#ffffff` |
| card-foreground | `#23211e` |
| popover | `#ffffff` |
| popover-foreground | `#23211e` |
| primary | `#1c5eab` |
| primary-foreground | `#ffffff` |
| secondary | `#f3f1ef` |
| secondary-foreground | `#23211e` |
| muted | `#f3f1ef` |
| muted-foreground | `#635d58` |
| accent | `#f3f1ef` |
| accent-foreground | `#23211e` |
| destructive | `#bd0916` |
| destructive-foreground | `#ffffff` |
| border | `#e5e2de` |
| input | `#cdc8c2` |
| ring | `#468de4` |
| link | `#1c5eab` |
| canvas | `#f5f7fa` |
| sidebar | `#fafbfe` |
| sidebar-foreground | `#3e3a37` |
| sidebar-muted | `#635d58` |
| sidebar-accent | `#e9f3ff` |
| sidebar-accent-foreground | `#0c3b71` |
| sidebar-hover | `#f3f1ef` |
| sidebar-border | `#e5e2de` |

## Type

- **Faces.** Inter Variable for everything; **PT Sans Narrow** (bold) — the
  display face — only for page titles, the logo and KPI figures
  (`font-display-bold`). Both cover Cyrillic (incl. ў қ ғ ҳ) and the Uzbek
  modifier letter ʻ (U+02BB) and ’ (U+2019).
- **Scale** (px / line height, Normal): caption 12/18 · small 13/20 ·
  table 14/21 · body 15/22.5 (forms too) · lead 16/24 · title 18/26 (section
  titles) · headline 28/36 (page titles) · display 34/40 (KPI figures).
  Large text moves each one step up (caption 13 … display 36). 12 px is the
  minimum anywhere. Classes
  `text-caption … text-display`; Tailwind's default sizes and `text-[Npx]`
  are forbidden (the scale test fails).
- **Weights.** 400 regular, 500 medium (labels, table headers, buttons),
  600 semibold (card titles); 700 only with the display face.
- **Numbers.** `font-variant-numeric: tabular-nums` is on for the whole app;
  `num` adds it explicitly where a component resets it. Amounts are
  right-aligned.

## Space, shape, elevation

- **4 px grid.** Spacing steps 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20
  (Tailwind units, × 4 px); `0.5` (2 px) only for hairlines and badge
  padding. Half steps (`1.5`, `2.5`) are forbidden.
- **Radii** sm 4 · md 6 · lg 8 · control 10 · xl 12 · 2xl 16 px. Cards xl
  (white, hairline border, very soft shadow, 24 px padding), inputs and
  buttons `rounded-control` at 40 px tall, badges md.
- **Page padding** 16 / 24 / 32 px (mobile / md / lg).
- **Tables.** No header bar: a quiet small-text header over hairline rows,
  a subtle slate-50 hover; regular rows about 48 px (the density switch keeps
  compact and comfortable). A table that cannot fit scrolls inside its own
  box with the first column frozen; the page itself never scrolls sideways
  and row actions stay visible (sticky right column on the Premium tab).
- **Page header.** Quiet breadcrumbs, the title (headline), a subtitle, the
  actions on the right.
- **Shadows** — `shadow-card` (hairline lift at rest), `shadow-pop` (menus,
  side panels, dialogs), and the search bar's pair: `shadow-search` at rest,
  `shadow-search-active` on hover, focus and with its suggestions.
- **Scrim** behind overlays: `bg-scrim/50`.

## Motion

IBM Carbon tokens: durations `fast-01` 70 ms, `fast-02` 110 ms, `moderate-01`
150 ms (productive: hover, press, small reveals), `moderate-02` 240 ms and
`slow-01` 400 ms (expressive: panels, page-level change). Easings
`productive-*` and `expressive-*` (`--ease-*`). The default transition is
150 ms productive-standard. Under `prefers-reduced-motion: reduce`, all
animation and transition durations collapse to ~0.

## Search

One search bar, in the top bar — search and filtering in one place (no
separate register search box, status pills or checkboxes). Google-like: a
white pill (`rounded-full`, 44 px, hairline border at rest that gives way to
`shadow-search-active` on hover / focus), search icon left, × to clear,
`Ctrl K` hint; suggestions open in a panel that continues the pill (same
width, rounded bottom) and floats over the page, so nothing moves.

**Language** (`src/features/search/query.ts`, one pure parser; unit tests in
`query.test.ts`): `,` AND · `;` OR between groups · `|` several values ·
`-` exclude · `"…"` exact phrase · `field:value` with `status mga broker lob
country ccy uw type ref` · `premium share si` with `> < >= <= ..` (k / m / bn)
· `received inception expiry bound` dates (`2026-10`, `01.10.2026`, `a..b`,
`30d`) · keywords `overdue expired noresponse mine today thisweek thismonth`.
Field names, keywords and status words in EN, RU and UZ; case, diacritics
and apostrophes ignored (`normalize.ts` = `public.search_norm()`). A word that
is exactly a status, MGA, line, country or currency filters by it (weak
synonyms like «new» only when alone in their part); anything not understood
is searched as text and its chip says so — never an error.

**In the database.** `postgrest.ts` turns the query into one PostgREST logic
tree on `submissions_v`; free text matches `submissions_v.search_text`. The
register and the Excel export run the same query.

**Behaviour.** Chips under the page header read the query back (one per part,
«OR» between groups, × removes that part from the text) with the result count.
On the register the table filters live (200 ms); elsewhere Enter opens the
register with the query; a direct hit (ref no. / insured) opens the record.
`?q=` holds the query (bookmarks, Back / Forward; old `?status=…` links are
rewritten once). Dashboard and counterparty links fill the bar with the
equivalent query (`overdue`, `status:offered|no_response`, `mga:"…"`).
Suggestions: recent searches (per user, with ×), `field:value` matches, direct
hits, pages; ↑ ↓ Enter Tab Esc; a syntax tip with a help popover.

**Filter builder.** The funnel icon at the right of the pill opens plain
controls for the page's fields (chips for short lists, searchable checklists
for long ones, min / max, from / to dates, switches). Apply writes the
equivalent query text into the bar (shown live as «Search: …» while you pick),
and the builder always opens on what the bar says — so people filter without
the syntax and learn it by seeing it. It edits one AND group; what it has no
control for (exclusions, OR, `ref:`, relative or open-ended ranges) is kept
exactly as typed. Model: `search/builder.ts` (unit-tested round trip).

**The only search / filter control.** The bar searches the list of the page
it is on — placeholder, words, suggestions, chips and builder follow the page.
No page has a search box, filter pills or filter checkboxes of its own.

| page | searches | words (EN / RU / UZ) | where |
|---|---|---|---|
| Submissions | the register | status, mga, broker, lob, country, ccy, uw, type, ref, premium, share, si, dates; overdue, expired, mine | database |
| Counterparties | the list | type (mga / broker / cedent), country; `inactive` shows inactive ones too | browser (reference-sized) |
| Agenda | follow-ups (both tabs) | assignee (`all`, a name, `mine`), type, due; overdue; today / thisweek = due | browser; `assignee:` loads others' (admin, management) |
| Admin › Users | users | role; active / inactive | browser |
| Admin › Reference data | currencies, countries, lines | text; active / inactive | browser |
| Admin › FX rates | all stored rates | ccy, date, source | database |
| anything else | submissions | — | Enter opens the register |

The admin tab is in the URL (`?tab=fx`), so the bar knows the list; switching
tab starts a fresh search.

**One engine, a scope per page.** `query.ts` is the parser; `scopes.ts` says
what each page's search knows (fields with EN/RU/UZ aliases, values, keywords);
`pages.ts` says which scope runs where, where its rows are filtered, the
builder's controls and the help examples.

## Interaction rules

- **Focus** — a 2 px `ring` (sky-400) outline on `:focus-visible`; outlines
  never change layout.
- **Hover** — colour and background only, never size, border width or
  weight (layout-stability test).
- **Feedback under 100 ms** — buttons respond on press (colour change at
  110 ms); long work shows a skeleton in the space the result will take.
- **Loading** — reserve the final size (skeleton rows, fixed card heights);
  page titles never move when data arrives.
- **Grid columns** — a flexible column next to a fixed one is
  `minmax(0,1fr)`, never `1fr`, so wide tables scroll inside their card
  instead of pushing the page sideways.

## Components

All under `src/components/`; screens compose them, never re-style them.

| component | file | rules |
|---|---|---|
| **Table v2** | `data/DataTable.tsx` | Density 40 / 48 / 56 px (default 48), remembered per user (`usePref`, localStorage keyed by user id). Sticky header and frozen first column inside a scroll box. Column show / hide (first column always shown), remembered. Row actions appear on hover / focus in a pinned right cell — reserved space, no shift. Selecting rows shows a floating bulk bar (fixed, never pushes the page). Search matches are wrapped in `<mark>` (`highlight()`). Skeleton rows at the final row height while loading. Empty → `EmptyState`. |
| **Quick view** | `features/*/…QuickView` | A right side panel with the essentials and the next actions (open, edit, open in register). Used by the register, the agenda and the counterparties list. |
| **Side panel** | `ui/dialog.tsx` | Every task dialog opens docked right (max 512 px, full height, 240 ms expressive slide); the footer sticks to the bottom edge. `variant="center"` only for short confirmations. |
| **KPI card** | `KpiCard.tsx` | Label, figure in the display face, change vs the previous comparable period (green = good direction, red = bad, grey = flat), 12-month sparkline, click-through to the rows behind it. `alert` puts the figure in danger ink. |
| **Badge** | `ui/badge.tsx` | One badge, tinted (`tint` fill, `line` border, `deep` text). Tones: neutral, brand, info, success, warning, danger, the 7 statuses, the 4 ageing buckets. `solid` only for things that must shout — 90+ days overdue, unread counts. `StatusBadge`, `AgingBadge` wrap it. |
| **Amount** | `Amount.tsx` | Tabular figures, currency after in muted ink. `human` shows 1.25M / 1,25 млн / 1,25 mln with the exact value in a tooltip — for KPIs, summaries, charts; tables keep full values. |
| **Empty state** | `EmptyState.tsx` | Own 64 px pictograms (search, inbox, done, documents, chart, people) in navy-500 / sky-400 on a navy-100 disc; one line on what is empty, one on why, and the action that fills it. |
| **Skeleton** | `Skeleton.tsx` | Placeholder blocks at the final size; `SkeletonRows` for tables. Replaces spinners on page loads. |
| **Inline success** | `SavedCheck.tsx` | «Saved ✓» next to the button for 2 s after an in-place save (space reserved). Toasts stay for things that happen elsewhere (created, exported). |
| **Segmented control** | `SegmentedControl.tsx` | For 2–5 options that fit on one line (business type, follow-up type, counterparty type filter). Radio-group semantics, arrow keys. |
| **Command palette** | `CommandPalette.tsx` | ⌘K / Ctrl K or the header search: pages (by role), actions (new submission, switch language), submissions by reference / insured, counterparties by name. ↑ ↓ Enter Esc. |
| **Tooltip** | `ui/tooltip.tsx` | 300 ms delay, dark slate, for full values and icon-only buttons. |

### Forms

- Labels above the field (13 px medium, foreground); a required star is
  decorative — the error says what is needed.
- Validate on blur (`mode: 'onTouched'`): nothing is red until the user
  leaves the field; after that the field re-checks as they type.
- Buttons name the outcome: «Create submission», «Save changes», «Close
  follow-up», «Move follow-up», «Set new password» — never a bare «Save» or
  «OK».
- Long forms have a sticky footer with the state («Unsaved changes», «Fix
  the highlighted fields (2)») and the outcome button, always in reach.

## Signature screens

| screen | what makes it the reference |
|---|---|
| Dashboard | Greeting with the date; one row of five KPI cards (delta + sparkline, each a link); the oldest unanswered offers as an action list with days waiting on the ageing scale, next to the ageing stacked bar; two charts only (bound premium by month, the status funnel in status colours); hit ratio and by-MGA / by-line one tab away. |
| Submissions register | Search + status chips with their colour dots; less-used filters behind «More filters» (badge shows how many are on, opens itself when any is); table v2 with quick view, bulk export, highlight. |
| Submission detail | Insured as the title, reference in the subtitle; a summary card with the status stepper (received → under review → offered → bound, each in its status colour with the date reached; an ended submission shows its outcome in place) and the five figures that matter. |
| Submission form | Grouped sections, labels above, segmented business type, live figures pinned on the right, sticky footer with the required-fields meter («Required: 4 of 5»), form state and the outcome button. |
| Agenda | Tighter rows: title + type + days-overdue badge; the submission line; amount at human scale and due / owner in aligned right-hand columns; quick view on hover; «All caught up» moment when the last item is closed. |
| Counterparty page | Summary card: type and open-items badges, six figures in one row, status-mix bar; their submissions in table v2; contacts as quick facts; details edited in a side panel. |
| Login | Branded split screen: navy panel with the layered-arcs pattern (or the owner's own photograph via `VITE_LOGIN_PHOTO`, under a ≥ 70 % navy veil that keeps white text ≥ 6 : 1 even over a white photo), product line in the display face; the form on white with today's date. Photography: owner's own only — no stock. |

## Tone of voice

Short, direct, active; the same register in EN, RU and UZ; polite (RU «вы»
form, UZ «siz» form, without capitalising them); name the outcome, not the
mechanism. Personality lives at the edges (login, empty states, completion
moments); tables, decision forms and errors stay plain and respectful — no
jokes, no codes.

**Rules**

1. Buttons say what will happen: verb + object («Create submission», «Close
   follow-up»). Never «OK», «Submit», a bare «Save» on a long form.
2. Errors say what to do next, in the user's terms («Enter a valid email
   address»), never a database message or code.
3. Empty states say what will appear here and how («New follow-ups appear
   here as they fall due»), positively.
4. Numbers carry their unit and baseline («+12 % vs same days last month»).
5. Use the business's words: submission, offer, bound, signed share, MGA —
   the same term on every screen (see `src/locales/*.json`).
6. Counts as «Label: N» in RU / UZ, so one string reads right for any number.
7. UZ uses oʻ / gʻ (U+02BB) and ’ (U+2019); RU uses «ёлочки» and ё where it
   matters (подтверждённая).

**Ten reference strings**

| # | Moment | EN | RU | UZ |
|---|---|---|---|---|
| 1 | Primary action, new record | Create submission | Создать заявку | Ariza yaratish |
| 2 | Primary action, edit | Save changes | Сохранить изменения | Oʻzgarishlarni saqlash |
| 3 | Closing a task | Close follow-up | Закрыть напоминание | Eslatmani yopish |
| 4 | Inline success | Saved | Сохранено | Saqlandi |
| 5 | Validation | Enter a valid email address | Введите корректный адрес эл. почты | Toʻgʻri elektron pochta manzilini kiriting |
| 6 | Sign-in failure | Wrong email or password | Неверная эл. почта или пароль | Elektron pochta yoki parol notoʻgʻri |
| 7 | Empty, filtered | No submissions match the filters. Try fewer filters or a shorter search. | Нет заявок по выбранным фильтрам. Уберите часть фильтров или сократите запрос. | Filtrlarga mos ariza yoʻq. Filtrlarni kamaytiring yoki qidiruvni qisqartiring. |
| 8 | Completion moment | All caught up — new follow-ups appear here as they fall due. | Всё сделано — новые напоминания появятся здесь, когда подойдёт срок. | Hammasi bajarildi — yangi eslatmalar muddati kelganda shu yerda paydo boʻladi. |
| 9 | Greeting | Good morning, Rustam · Thursday, 29 October | Доброе утро, Рустам · четверг, 29 октября | Xayrli tong, Rustam · payshanba, 29-oktabr |
| 10 | KPI baseline | +12 % vs same days last month | +12 % к тем же дням прошлого месяца | oʻtgan oyning shu kunlariga nisbatan +12 % |

## Language

- UZ text uses oʻ / gʻ (U+02BB) and ’ (U+2019) for the tutuq belgisi, never
  the ASCII `'`.
- RU uses «ёлочки» quotes, never straight double quotes.
- Dates in UZ are written out in code (`formatDate`, `formatLongDate`): «21-fev, 2026», «payshanba, 29-oktabr» — some browsers lack Uzbek month names and print «M02».

## Guards (run in CI and locally)

| check | command | what it proves |
|---|---|---|
| tokens in sync | `npm test` (`tokens.test.ts`) | `tokens.css` equals what `palette.ts` generates |
| type, spacing, colour scale | `npm test` (`scale.test.ts`) | no off-scale sizes, half steps, hex colours or stray weights |
| contrast | `npm test` (`contrast.test.ts`) | palette pairing rule, every status/ageing pair, and every colour class pair in `src` ≥ 4.5 : 1 text / 3 : 1 icons |
| layout stability | `npx playwright test layout-stability` | 7 screens × EN/RU/UZ: no landmark moves on load, hover, focus or menu open |
| search | `npm test` (`query.test.ts`), `npx playwright test search` | the parser on every example in EN/RU/UZ and messy input; typing, chips, OR, URL / Back, Ctrl K, keyboard suggestions, export = results, the bar in 4 themes × 2 text sizes |
| components | `npx playwright test components` | density / columns remembered, sticky header, frozen column, highlight, bulk bar, quick views, ⌘K, blur validation, sticky footer, side panels |
| screenshots | `SHOTS=<dir> npx playwright test screenshots` | before/after captures, offline mock data |
