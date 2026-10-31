# Backlog

Small follow-ups noted during the design reviews; not yet scheduled.

| # | Where | What | Noted | Done |
|---|---|---|---|---|
| 1 | Submissions register, total above the table | Rename «Итого наша брутто» to «Подтверждено» (and EN / UZ to match), next to «в ожидании». | Screenshot review v3, 2026-10-31 | ✅ 2026-10-31 — commit "Register total renamed «Подтверждено» / Bound / Tasdiqlangan" |
| 2 | Submissions register, «Вид» column | Long Russian line-of-business names are truncated («Строительно…», «Финансовые …», «Кредит и пор…»): widen the column, use short LOB names, or show the full name on a second line. | Screenshot review v3, 2026-10-31 | ✅ 2026-10-31 — commit "Lines of business: short names (EN/RU/UZ) in tables, chips and charts; full names in forms, detail pages and tooltips" (migration 20261031163621_lob_short_names.sql, applied) |
| 3 | Dashboard card headers | «Открыть в реестре» wraps to its own line under long card titles (e.g. «Самые старые предложения без ответа»): keep title and link on one line (shorter link text / icon link / title truncation). | Screenshot review v3, 2026-10-31 | ✅ 2026-10-31 — commit "Dashboard card headers: title and a compact «Все →» link on one line" |
| 4 | Search bar, free-text search | Free-text search should also match the short names of lines of business in EN / RU / UZ (e.g. «Строительство», «Qurilish»). Today `search_text` holds the full names only; the `lob:` filter already accepts short names. | 2026-10-31 | |
