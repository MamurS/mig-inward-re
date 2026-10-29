# Colour audit — October 2026

Every colour the code used on `main` before the redesign (commit `c1611c2`),
what it became, and the contrast it reaches. Contrast ratios are WCAG 2.x
relative-luminance ratios; the target is 4.5 : 1 for text and 3 : 1 for icons
and large text. The automated version of this audit is
`src/design/contrast.test.ts` (it reads every class list in `src` and fails on
any pair below target).

## Summary

| | before | after |
|---|---|---|
| Colour system | shadcn default neutrals (`oklch(… 0 0)`, cool grey) + Tailwind palette colours picked per screen (amber, emerald, sky, orange, rose, zinc, red, slate) | 10 OKLCH ramps of equal luminance per step + roles + two domain scales (status, ageing) + chart sets |
| Distinct colour classes in `src` | 72 | 76 (meaning-named: `status-*`, `warning-*`, `success-*`, roles) |
| Raw Tailwind palette colours (`amber-*`, `emerald-*` …) | 26 classes | 0 — all moved to ramps |
| Hex colours in components | 1 (`#E8EDF5`, Excel export header fill) | 1 — kept: it styles the downloaded `.xlsx`, not a screen |
| Pairs below target | 1 failing (white 10 px text on `red-500`, 3.76 : 1), 1 marginal (amber-600 icon 3.19 : 1) | 0 (test-enforced) |
| Status colours | received and NTU both grey; no link between badge and chart colours | 7 distinct hues on a funnel order; same hue in badge, bar and dot |
| Overdue ageing | none | 4-step yellow → red scale, 90+ solid |

## Before → after, by use

| where | before | ratio | after | ratio |
|---|---|---|---|---|
| Sidebar agenda counter (`AppLayout`) | `bg-red-500 text-white`, 10 px | **3.76** ✗ | `bg-danger-600 text-white`, 12 px caption | 6.53 |
| Offer-expired icon (register) | `text-amber-600` | 3.19 (icon, marginal) | `text-warning-600` | 6.49 |
| Done check (follow-ups) | `text-emerald-600` | 3.77 | `text-success-600` | 6.54 |
| No-access warning icon | `text-amber-600` | 3.19 | `text-warning-600` | 6.49 |
| Warning notes (status dialog, offer expiry) | `bg-amber-50 text-amber-800/900` | ≥ 6.8 | `bg-warning-100 text-warning-700` | 7.66 |
| Success notes (new user, evidence tag) | `bg-emerald-50 text-emerald-700/800` | 5.21 | `bg-success-100 text-success-700` | 7.69 |
| Dialog scrim | `bg-black/40` | — | `bg-scrim/50` (navy-900) | — |
| Dashboard bars | hard-coded navy / grey | — | `navy-500` (bound), `navy-300` (other); grid `slate-100` | — |
| Status badge · received | `slate-700 on slate-100` | 9.45 | `status-received-deep on -tint` (blue) | 7.67 |
| · under review | `sky-700 on sky-50` | 5.57 | violet | 7.56 |
| · offered | `amber-800 on amber-50` | 6.84 | amber | 7.64 |
| · no response | `orange-800 on orange-50` | 6.88 | orange | 7.62 |
| · bound | `emerald-700 on emerald-50` | 5.21 | green | 7.69 |
| · declined | `rose-700 on rose-50` | 5.72 | red | 7.66 |
| · NTU | `zinc-600 on zinc-100` | 7.03 | warm grey | 7.62 |
| Secondary text | `muted-foreground` oklch(0.52 0.03 260), cool | — | `slate-600` `#635d58` on white / canvas | 6.49 / 6.02 |
| Primary button | oklch(0.32 0.08 255) | — | `navy-600` `#1b609e`, white text | 6.53 |
| Sidebar | oklch(0.24 0.05 260) | — | `navy-800` `#0a3c68`; text `slate-50`, muted `navy-200` | 10.82 / 8.66 |
| Focus ring | `ring` cool grey | — | `sky-400` `#0095c9` on white | 3.42 |
| Links | `text-primary` | — | `link` = `sky-600` `#00658a` | 6.50 |

## Findings fixed

1. **White on red-500 counter** (3.76 : 1 at 10 px) — below the text minimum;
   now `danger-600` at the 12 px caption size.
2. **Received and NTU were both grey** — two statuses indistinguishable at a
   glance; each status now has its own hue.
3. **Amber icons at 3.19 : 1** — passed the icon minimum by 0.19; moved to
   `warning-600`.
4. **Cool grey neutrals with warm amber accents** — replaced by warm neutrals
   so greys and accents sit in one temperature.
5. **No overdue scale** — added (needed by Phase 2 receivables and the agenda).

Exact values of every ramp step, status and ageing colour are in `DESIGN.md`
(«Palette values»).
