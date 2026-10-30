# Phase D — AI-assisted data entry: what was built and the self-review

Scope: the master plan, part D. Defaults: `docs/decisions.md` rows 27–35.
Supabase project `jltrtqwaxvsrnqmjemzc` only.

**Nothing is saved by the AI.** It suggests; the user reviews each field
(value, confidence, the snippet of the document it came from), ticks what to
use, and saves the form as usual.

## Owner action to switch it on

1. Supabase → Edge Functions → Secrets (project `jltrtqwaxvsrnqmjemzc`):
   - `ANTHROPIC_API_KEY` — a paid Anthropic API key (not a free tier);
   - optional `AI_PROVIDER` (`anthropic` default, or `ollama`) and `AI_MODEL`
     (default `claude-haiku-5-5`);
   - for a self-hosted model instead: `AI_PROVIDER=ollama`,
     `OLLAMA_BASE_URL` (any OpenAI-compatible endpoint), optional
     `OLLAMA_API_KEY`, `AI_MODEL` (e.g. `qwen2.5vl:7b`).
2. In the app: Admin › AI → switch on, choose the roles, the daily limit → Save.

Until both are done the «Fill from document» button does not show; the
function answers `not_configured` / `disabled` and logs it.

## Database

Migrations: `20261030122853_ai_assist`, `20261030140000_demo_data_ai`.

- Settings `ai_enabled` (false), `ai_roles` (admin, underwriter, finance,
  claims), `ai_daily_limit` (100).
- **`ai_usage_log`**: one row per call — user, kind (submission /
  bordereau_mapping), provider, model, status (ok, cached, error, refused,
  limit, disabled, too_big), file name, size, SHA-256, tokens in / out,
  duration, error. Written only by the Edge Function (service role); users
  read their own rows, admins all. Never the document or the answer.
- **`ai_cache`**: the cleaned answer by content hash (per demo / real world);
  admins read it.
- `ai_usage_v` (names, search text), `ai_available()` (switch + role).
- RLS, grants (select to authenticated, nothing to anon), audit trigger,
  `is_demo` + restrictive demo policies + demo guard; «Delete all demo data»
  and the demo counts cover both tables.
- `supabase/tests/ai_rules.sql` 3/3 (switch and roles, log and cache access,
  demo isolation).

## Edge Function `ai-extract`

`supabase/functions/ai-extract/` — `index.ts` (checks and flow),
`adapters.ts` (providers), `schemas.ts` (JSON schemas and instructions,
`PROMPT_VERSION`). `verify_jwt` on. Order: signed in and active → switched on
for the role → size caps → provider configured → cache → daily limit → model
→ answer cleaned to the promised shape (unknown fields dropped, confidence
clamped 0–1, mapping columns must exist and be used once) → cache + log.

- **Anthropic** (default): the official SDK, `claude-haiku-5-5`, effort low,
  `output_config.format` json_schema (strict), the instructions cached;
  PDFs and images sent as documents / images; refusal and cut-off answers
  reported, typed API errors mapped to plain messages.
- **Ollama / OpenAI-compatible**: `/v1/chat/completions` with
  `response_format` json_schema; text and images (PDF → convert first).
- Works the same on self-hosted Supabase (edge-runtime): only env secrets.

## Screens

- **New / edit submission → «Fill from document»** (side panel): a file
  (PDF, image, text, e-mail) or pasted text → each field with its value,
  confidence badge, source snippet and problems (unknown line / country /
  currency, counterparty not found or unsure, a date or number that cannot
  be read); low-confidence values unticked; counterparties matched by name
  (transliteration, legal forms, trigram similarity); **duplicate warning**
  for similar insureds already in the register (same MGA, overlapping
  period); the model's notes. «Apply» fills the form; the filled inputs keep
  a coloured ring and the banner lists them until edited; nothing is written
  until «Create / Save».
- **Bordereau wizard → «Suggest with AI»** on the mapping step: columns
  mapped with a confidence badge per field (≥ 0.5 applied), cleared on a
  manual change; the template is saved as before.
- **Admin › AI**: switch, roles, daily limit; the usage log (Table v2,
  search words, chips, totals of tokens).
- EN / RU / UZ.

## Tests

- Unit: `match.test.ts` (8), `apply.test.ts` (5).
- e2e `ai.spec.ts` (5) on the offline mock (a canned reading; never a real
  model): suggestions, matches, duplicates, nothing saved until Save, cache,
  AI mapping, Admin › AI, RU / UZ.
- DB: `supabase/tests/ai_rules.sql` 3/3.

## Self-review

- The key never reaches the browser or the repo: Edge Function secrets only;
  `.env.example` has no AI variables by design.
- The function checks the role itself (service-role reads only after
  `getUser`), logs every path, and caps size before any model call.
- The answer is re-shaped server-side, so the screens never trust raw model
  output; the form validates again on save, the database again on insert.
- Cost: one call per document, effort low, cached instructions, cached
  answers, a daily cap per user.
