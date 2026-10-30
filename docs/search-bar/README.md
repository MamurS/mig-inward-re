# One smart search bar

**What it is.** Search and filtering now live in one place: the top bar. The Submissions page no longer has its own search box, status pills, the "Overdue follow-up" / "Expired offer" checkboxes, or the "More filters" dropdowns. Every one of those filters can now be written in the bar. The syntax is in DESIGN.md «Search»; the code is in `src/features/search/`.

## Database (additive, `20261030050401_search_text.sql`, project `jltrtqwaxvsrnqmjemzc`)

- **`public.search_norm(text)`:** an immutable SQL function that runs as the caller and has a fixed `search_path`.
  - What it does: lower-cases the text, maps accented letters to their base letter, and drops apostrophe forms.
  - Access: `execute` is granted to `authenticated` only; `public` and `anon` are revoked.
- **`submissions_v.search_text`:** a new column appended at the end of the view; existing columns are unchanged.
  - Contents: the ref no., insured, risk, MGA, broker and source, plus the country and line of business in EN/RU/UZ, and the notes.
- **No index:** at the current register size a scan is fast. DESIGN.md notes when to add a stored column with a trigram index.
- **Security advisor:** nothing new.

## How it works

- **`query.ts`:** a pure parser that turns the bar's text into a structured query.
- **`postgrest.ts`:** turns that query into one PostgREST filter on `submissions_v`, so filtering runs in the database.
  - The live PostgREST accepts every filter shape we generate (checked against the real endpoint).
- **One query for table and export:** the register and the Excel export use the same query.
- **`normalize.ts`:** the browser's copy of `search_norm`.
  - A unit test fails if the two character lists drift apart.

## Tests

- **Unit tests:** 29 for search, 52 in total.
  - Every example from the brief, in EN, RU and UZ.
  - Messy input: extra spaces, trailing separators, unknown fields, unclosed quotes, and characters that mean something in the filter syntax.
  - Removing a chip, and the database filter strings.
- **Browser tests:** `e2e/search.spec.ts`, 20 tests.
  - Typing filters the table live.
  - Free text is case- and accent-insensitive.
  - Chips, removing a chip, OR groups, exclusions, and parts searched as text.
  - Reload, Back and Forward.
  - Ctrl K from another page, then Enter.
  - Suggestions by keyboard (arrows, Enter, Tab), recent searches, and the help popover in RU.
  - RU and UZ words.
  - The exported .xlsx has exactly the rows on screen.
  - Dashboard tiles and old links fill the bar.
  - The bar in 4 themes × 2 text sizes:
    - white pill, 44 px tall;
    - the panel has the same width as the pill;
    - opening it moves nothing;
    - no sideways scroll.
- **Full suite:** vitest 52/52, Playwright 85/85.
  - The feedback test (actions answer within 100 ms) now times opening the search panel (6 ms) and removing a chip (49 ms).

## Filter builder

The funnel icon at the right of the pill opens plain controls for the page's fields.
- **Short lists** (status, currency, business type) are chips.
- **Long lists** (MGA, broker, line, country, underwriter) are searchable checklists.
- **Ranges:** premium min / max, and from / to dates for received, inception and expiry.
- **Switches:** overdue, offer expired, no response.

**How it connects to the bar**
- **Apply** writes the equivalent text into the bar. The text is shown live under «Search» while you pick.
- The builder always **opens on what the bar says**, so editing the text updates the builder.
- Whatever the builder has no control for is kept exactly as typed: exclusions, `ref:`, relative or open-ended ranges.
- A search with OR groups shows a notice instead of controls.

**Tests**
- `builder.test.ts`: 6 tests on the round trip.
- `e2e/search.spec.ts`: building a query from the controls, reading the bar back into them, RU/UZ, and the builder fitting the window in 4 themes × 2 text sizes.
- Screenshots: `<theme>-<size>-builder.jpg`.

## Search on every page

The bar is the **only** search and filter control. On each page it searches and filters that page's list, with that page's placeholder, words (EN/RU/UZ), suggestions, chips, filter builder and help examples. `?q=` keeps the search in the URL everywhere.

| Page | Removed | Now in the bar |
|---|---|---|
| **Counterparties** | search box, MGA / broker / cedent switch, "Show inactive" checkbox, three "+" icon buttons | free text (name, country in 3 languages, contacts' names, roles, e-mails and phones, notes); `type:mga\|broker\|cedent`; `country:`; `inactive` shows inactive ones too. Added: **Export to Excel** (exactly what is shown) and one primary **New counterparty** button that asks for the type in the form. |
| **Agenda** | "Assigned to" dropdown (admin / management) | `assignee:all` / a name / `mine` (default: your own); `type:`; `due<7d`, `due:a..b`; `overdue`; `today`, `thisweek`, `thismonth` mean due; free text (title, ref no., insured, MGA, outcome). Filters both tabs. |
| **Admin › Users** | — (no filter before) | free text (name, e-mail), `role:`, `active` / `inactive` |
| **Admin › Reference data** | — | free text over code and names in every language, `active` / `inactive` — all three tables at once |
| **Admin › FX rates** | currency filter dropdown | `ccy:` (a bare code too), `date>=…` / `date:a..b`, `source:`; filtered in the database over all stored rates, not only the 300 latest shown |
| Dashboard, a submission, the form, Settings, Jobs | — | no list of their own: the bar searches submissions; Enter opens the register |

**Kept on purpose**, because they are views or settings, not filters:
- the Agenda's Open / Done tabs, the Admin tabs and the submission tabs;
- the register's Density / Columns;
- the Dashboard's reporting **Period**: it sets the year the KPIs and charts cover, not a list filter. It could move into the bar if you want.

**Receipts / Receivables** don't exist yet; Phase 2 steps 3–4 build them on the bar from the start.

**One engine.**
- `query.ts` parses for every page.
- `scopes.ts` holds each page's vocabulary.
- `pages.ts` maps pages to scopes.
- Lists that are already loaded whole are filtered in the browser by `client.ts`, with the same rules as the database filter.

**Bug fixed along the way:** a navigation started from the bar could reset the bar a moment later and erase text typed meanwhile, and a pending live-filter write could land on the next tab. Both are covered by tests now.

**Tests**
- Unit (`scopes.test.ts`, 7): every new scope in EN/RU/UZ, plus the in-browser filter and the FX database filter.
- Browser (`e2e/search-pages.spec.ts`, 16):
  - no page controls left;
  - each page's words, chips, URL, export and builder;
  - "New counterparty";
  - every page's bar and builder in 4 themes × 2 text sizes.
- Screenshots: `page-*.jpg`.

## Screenshots (`screenshots/`)

- **Each theme and text size:** `<theme>-<size>-chips.jpg` and `<theme>-<size>-suggestions.jpg`, using the query `Silk Road Underwriting Agency, bound; caspian, -declined, premium>10k`.
- **Help popover:** `help-en.jpg`.
- **RU and UZ, Large text:** `chips-ru-large.jpg` and `chips-uz-large.jpg`.

Regenerate: `SHOTS=docs/search-bar/screenshots npx playwright test screenshots-search`.

## Later

When Phase 2 step 4 adds the receivables register, the same parser gains `overdue>45`, `bucket:61-90` and `payable`.
