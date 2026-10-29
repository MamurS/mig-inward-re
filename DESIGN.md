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
  surfaces. `navy` — the brand, reserved for the sidebar, the primary button
  and focus of brand moments. `sky` — secondary: focus ring, links,
  informational highlights. `success`, `warning`, `danger`, `info` — feedback.
  `violet`, `teal`, `magenta` — only for data (charts, status scale).
- **Page background** is the warm canvas; cards are white.
- **No dark theme** for now: the light theme is the default, and a dark theme
  ships only once it passes the same contrast test.

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
that keeps neighbours distinct), sequential `seq-1 … seq-9` (navy 100 … 900).

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

Canvas `#f8f6f5` `oklch(97.4% 0.003 48.7)`. Pairing: 5 steps worst 4.62 (canvas/slate-500), 4 steps worst 3.13 (canvas/navy-400).

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

data-1 `#4690d7` (3.37 : 1 on white) · data-2 `#c37c00` (3.39 : 1 on white) · data-3 `#009c97` (3.39 : 1 on white) · data-4 `#dc5dab` (3.39 : 1 on white) · data-5 `#0095c9` (3.42 : 1 on white) · data-6 `#00a05b` (3.40 : 1 on white) · data-7 `#a274e8` (3.39 : 1 on white) · data-8 `#fe4741` (3.39 : 1 on white)

### Roles

| role | hex |
|---|---|
| background | `#ffffff` |
| foreground | `#23211e` |
| card | `#ffffff` |
| card-foreground | `#23211e` |
| popover | `#ffffff` |
| popover-foreground | `#23211e` |
| primary | `#1b609e` |
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
| ring | `#0095c9` |
| link | `#00658a` |
| sidebar | `#0a3c68` |
| sidebar-foreground | `#fafaf9` |
| sidebar-muted | `#cce4ff` |
| sidebar-accent | `#124f84` |

## Type

- **Faces.** Inter Variable for everything; **PT Sans Narrow** (bold) — the
  display face — only for page titles, the logo and KPI figures
  (`font-display-bold`). Both cover Cyrillic (incl. ў қ ғ ҳ) and the Uzbek
  modifier letter ʻ (U+02BB) and ’ (U+2019).
- **Scale** (px / line height): caption 12/16 · small 13/18 · body 14/20 ·
  lead 16/24 · title 20/28 · headline 28/34 · display 36/40. Classes
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
- **Radii** sm 4 · md 6 · lg 8 · xl 12 px. Cards xl, controls md, badges md.
- **Shadows** — two only: `shadow-card` (hairline lift at rest) and
  `shadow-pop` (menus, side panels, dialogs).
- **Scrim** behind overlays: `bg-scrim/50`.

## Motion

IBM Carbon tokens: durations `fast-01` 70 ms, `fast-02` 110 ms, `moderate-01`
150 ms (productive: hover, press, small reveals), `moderate-02` 240 ms and
`slow-01` 400 ms (expressive: panels, page-level change). Easings
`productive-*` and `expressive-*` (`--ease-*`). The default transition is
110 ms productive-standard. Under `prefers-reduced-motion: reduce`, all
animation and transition durations collapse to ~0.

## Interaction rules

- **Focus** — a 2 px `ring` (sky-400) outline on `:focus-visible`; outlines
  never change layout.
- **Hover** — colour and background only, never size, border width or
  weight (layout-stability test).
- **Feedback under 100 ms** — buttons respond on press; long work shows a
  spinner or skeleton in the space the result will take.
- **Loading** — reserve the final size (skeleton rows, fixed card heights);
  page titles never move when data arrives.
- **Grid columns** — a flexible column next to a fixed one is
  `minmax(0,1fr)`, never `1fr`, so wide tables scroll inside their card
  instead of pushing the page sideways.

## Language

- UZ text uses oʻ / gʻ (U+02BB) and ’ (U+2019) for the tutuq belgisi, never
  the ASCII `'`.
- RU uses «ёлочки» quotes, never straight double quotes.
- Tone guide (10 strings per language): added in Phase 3.

## Guards (run in CI and locally)

| check | command | what it proves |
|---|---|---|
| tokens in sync | `npm test` (`tokens.test.ts`) | `tokens.css` equals what `palette.ts` generates |
| type, spacing, colour scale | `npm test` (`scale.test.ts`) | no off-scale sizes, half steps, hex colours or stray weights |
| contrast | `npm test` (`contrast.test.ts`) | palette pairing rule, every status/ageing pair, and every colour class pair in `src` ≥ 4.5 : 1 text / 3 : 1 icons |
| layout stability | `npx playwright test layout-stability` | 7 screens × EN/RU/UZ: no landmark moves on load, hover, focus or menu open |
| screenshots | `SHOTS=<dir> npx playwright test screenshots` | before/after captures, offline mock data |
