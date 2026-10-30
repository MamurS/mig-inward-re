# Phase C — Binders and bordereaux: what was built and the self-review

Scope: the master plan, part C. Defaults for its open points:
`docs/decisions.md` (rows 18–26). Supabase project `jltrtqwaxvsrnqmjemzc` only.

## Database

Migrations (additive): `20261030103311_binder_enums`, `20261030110100_binders`
(applied by the owner in the SQL editor, then recorded in the migration
history), `20261030114539_seed_demo_binders`.

- **`binders`**: the MGA's authority.
  - Reference: `DEMO-` for demo binders, enforced.
  - Parties: MGA (must be an MGA), broker, underwriter.
  - Terms: period, currency, our share, commission, brokerage.
  - Limits at 100 %: a limit per risk and an aggregate limit.
  - Territories (none = anywhere).
  - Bordereaux owed: which kinds, monthly or quarterly, and due days after the period.
  - Status: draft / active / expired / cancelled.
- **`binder_lobs`**: the lines a binder may write, each with an optional limit of its own.
- **`submissions.binder_id`**: only a *binder* submission links to a binder, and only to a binder of its own MGA and its own world (demo or real).
- **`bordereau_templates`**: an MGA's column mapping per kind (header row, sheet), reused on the next upload.
- **`bordereaux`**: one row per imported bordereau.
  - Numbered `BDX-YYYY-0001` (demo: `DEMO-BDX-…`).
  - Records the period, received date, file name, the MGA's stated total, our computed total and the comment when they differ.
  - Counts lines, warnings and lines left out, and links the installments it created.
- **`bordereau_lines`**: the imported lines.
  - Each keeps its raw row, check messages and comment, and the claim it matched.
  - **The database checks every line again** before saving it:
    - inception inside the binder period;
    - line of business in the binder;
    - territory in the binder;
    - not above the limit per risk or the line's limit.
  - A warning needs a comment.
  - Duplicates are refused by a unique index on binder + kind + key.
  - Lines and bordereaux are records: they are never edited or deleted. The only change allowed is recording the matched claim.
- **`import_bordereau(header, lines, rejected)`** (security invoker, so each role's RLS applies). One call, all or nothing:
  - **premium**: one installment per currency on the binder's bound submission. It holds our share of the lines' gross premium, with commission and brokerage deducted, and is due at the period end plus the due days. A negative total becomes return premium.
  - **claims**: each line finds its claim by the cedent's reference on that risk, or opens one; it is never duplicated. The reserve moves to our share of paid + outstanding.
  - **risk**: the capacity check. At **80 % and 100 %** of the aggregate, management and the underwriter each get a follow-up, once per level.
  - The MGA's stated total against the lines' total: a difference needs a comment.
- **`binder_capacity_v`**: the risk lines' limits (sum insured when there is no limit). Other currencies are converted through USD rates; lines with no rate are counted separately.
- **`binder_periods(binder)`**: every period and kind owed, with its state:
  - *received*;
  - *late* (received after the due date);
  - *missing* (due date passed);
  - *upcoming*.
- **`binders_v`**: the register view, with capacity %, missing and late counts, last received date and search text.
- **Daily job `run_daily_bordereau_follow_ups`** (03:25 UTC): a *bordereau missing* follow-up per missing period and kind, for the binder's underwriter (or the underwriter team), created once. It skips demo binders.
- **Roles**:
  - binders: underwriters and admin create and edit;
  - risk bordereaux: any of underwriter, finance, claims, admin uploads;
  - premium bordereaux: finance and admin (they add installments);
  - claims bordereaux: claims and admin;
  - everyone reads.
- Audit log on all five tables. `follow_ups_v` shows the binder's reference and MGA.
- **Demo data**: every new table has `is_demo`, the restrictive policy and the guard. Children follow their binder or bordereau. A binder or template cannot use a counterparty from the other world. The link check, «Delete all demo data» and the counts all cover the new tables.

## Screens

- **Binders register** (`/binders`, every role):
  - Columns: reference, MGA (with its submission), status, period, lines, share, currency, aggregate, a capacity bar (amber at 80 %, red at 100 %), and bordereaux missing / late.
  - Search bar: `status:`, `mga:`, `uw:`, `ccy:`, `ref:`, `capacity>=80`, `expires<90d`, `starts:`, and the flags `missing`, `late`, `full`, `mine`.
  - Excel export = what is shown.
- **New / edit binder** (side panel; underwriters and admin):
  - the terms;
  - lines of business, each with an optional limit;
  - territories;
  - which bordereaux are owed, how often, and how many days after the period.
- **Binder page**:
  - Header: status, capacity alerts, missing / late counts. Our share and deductions, limit per risk, aggregate, capacity used (amount and bar), premium of the binder submission — its schedule and every premium bordereau (gross, net, paid) and the **loss ratio** (incurred / premium).
  - Linked submission, broker, underwriter, frequency, lines with their limits, territories.
  - **Bordereaux by period**: a grid of periods × kinds showing received / late / missing / upcoming. Each cell links to its bordereau, or to «Upload» when missing.
  - Tabs:
    - Bordereaux: each one opens a side panel with its totals, the original file, and the lines with their warning comments and claim links;
    - Premium: the installments;
    - Claims;
    - Documents;
    - Change log.
  - Follow-ups.
- **Upload wizard** (side panel):
  1. Kind, period (the oldest one owed comes first), received date, and the file (Excel or CSV, up to 10 MB and 5,000 rows).
  2. Columns: the MGA's saved mapping is applied, otherwise a guess from the titles (EN / RU). Sheet and header row can be changed; first values are shown; the mapping can be saved.
  3. Check:
     - every line is checked: errors are listed and left out; warnings each need a comment;
     - the lines' total is set against the MGA's stated total, with a comment when they differ;
     - a sentence states what the import will do.
  4. Import: shows the result (reference, lines, installments, lines left out). **The original file is kept** as a document on the bordereau.
- **Dashboard › Binders**:
  - Counts: active binders, bordereaux missing, received late, and capacity alerts (≥ 80 %). Each opens the filtered register.
  - Lists: «Bordereaux to chase» and the capacity alerts with their bars.
- **Submission form**: when the business type is *Binder*, a binder picker shows the MGA's binders.
- Agenda and follow-ups: binder follow-ups link to the binder page. Underwriters and admin can act on them.

## Self-review

`supabase/tests/binder_rules.sql`: 7 rolled-back checks on the live project, all pass.

1. **Roles**:
   - an underwriter creates a binder;
   - a binder for a broker is refused;
   - finance cannot create one.
2. **The binder submission**: it links only as *binder*, only to its own MGA's binder, and binds normally.
3. **Risk bordereau**:
   - refused: outside the binder period, a territory outside the binder, above the limit per risk, above the line's limit, a warning without a comment;
   - an import with a warning and one line left out is counted right;
   - the same line again is refused;
   - a line cannot be changed;
   - capacity reaches 85 % and both 80 % alerts go out (management and underwriter).
4. **Periods**:
   - the first month's risk bordereau is *late* and its premium bordereau *missing*;
   - the job creates the follow-up once, not twice;
   - the follow-up shows the binder's reference.
5. **Premium bordereau** (finance):
   - totals that differ without a comment are refused;
   - with the comment, one installment: 20 % of 30,000 = 6,000 gross, commission 1,500 and brokerage 300 deducted, net 4,200, due at the period end + 30 days.
6. **Claims bordereau** (claims role):
   - the first bordereau opens claim C-77 with a reserve of 10,000;
   - the next month's bordereau moves the same claim to 12,000, with no duplicate;
   - an underwriter cannot import claims.
7. **Demo isolation**:
   - a real user sees no demo binders, and demo mode sees only demo ones;
   - the link check is clean;
   - «Delete all demo data» removes demo binders and keeps the real one.

Line checks: `src/features/binders/validate.test.ts` (13). Covers:
- CSV with quotes and guessed delimiters;
- dates in ISO, day-first and Excel serial form;
- exact amounts in all common notations;
- column guessing in EN / RU, and templates;
- every error and warning;
- duplicates within the file and against earlier bordereaux;
- exact totals;
- the import payload;
- month and quarter periods.

Browser: `e2e/binders.spec.ts` (8).
- Register: its search words and export.
- Binder page: capacity alert, periods grid, a bordereau's lines.
- A new binder.
- Risk upload:
  - the saved mapping is applied;
  - territory and limit errors;
  - comments on warnings;
  - capacity reaching 100 % and its alert;
  - duplicates refused on a second upload.
- Premium upload: totals with a comment, then the installment (6,000 gross, 4,350 net).
- Claims upload: a claim opened, then the same claim's reserve moved, never duplicated.
- Dashboard section and the submission form's binder picker.
- Roles: management reads only.
- Demo isolation; RU / UZ.

Binder pages are in the overlap and large-text checks.

Screenshots: `docs/binders/screenshots/` (register, binder page, the wizard's mapping and check steps, the dashboard section, the binder page in RU and UZ large text).

Security advisor (30 Oct): the one new definer function it lists is
`binder_capacity_alert(binder)`. It is callable so that the invoker-rights
import can raise the alert. It takes no level from the caller: it works out
capacity itself, and it only creates the 80 % / 100 % follow-ups the data
already calls for, once each. The demo guard refuses it across worlds. The
other new definer functions (triggers, the job, the seed) cannot be executed
by `anon` or `authenticated`.
