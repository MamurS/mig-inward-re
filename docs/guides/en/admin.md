# MIG Inward Re — Admin guide

This guide is for administrators. An admin can do everything the other roles can do, and also runs the **Admin** page: users, reference data, FX rates, settings, AI, jobs and demo data.

For the daily work of each team, read the other guides: [Underwriter](underwriter.md), [Finance](finance.md), [Claims](claims.md) and [Management](management.md).

## 1. What you see and what you can change

You start on the **Dashboard**. Every menu item is available, plus **Admin**.

- You can do everything underwriters, finance and claims can do:
  - submissions and statuses;
  - premium schedules, receipts and write-offs;
  - claims, reserves and payments;
  - binders and all three kinds of bordereaux.
- You can see everyone's follow-ups. In **My agenda**, search `assignee:all`.
- You can delete any document, except one marked **Confirmation evidence**.
- The **Admin** page has seven tabs: **Users & roles**, **Reference data**, **FX rates**, **Settings**, **AI**, **Scheduled jobs** and **Demo data**.

## 2. Everyday tasks

### Users & roles

1. Click **New user**. Enter the **Email**, **Name**, **Role** and a **Temporary password** (at least 10 characters).
2. Click **Create user**. The password is shown only once. Copy it and give it to the person; they can sign in straight away.
3. To change someone's name, role or **Active** box, edit the row and click **Save** on it.
4. The key button sets a new password (**Set new password**).

People who leave are **deactivated, not deleted**, so their name stays on their work. A user with "— no access —" sees a "Waiting for access" page. You cannot deactivate yourself.

Roles: Admin, Underwriter, Finance, Claims, Management.

### Reference data

- Keep three tables: **Lines of business**, **Currencies** and **Countries**.
- Lines and countries have a **Code** and a name in EN, RU and UZ.
- Use **Add** for a new row. A code that already exists is refused.
- MGAs, brokers and cedents are managed on the **Counterparties** page, not here.

### FX rates

- In **Add / update an FX rate**, choose the currency and **Date**, enter **USD per 1 …**, and click **Add**.
- The rate is how many USD you get for 1 unit of the currency.
- Amounts use the latest rate on or before their date.
- No rates are loaded for you. Anything with no rate is left out of USD totals and counted on screen.

### Settings

Settings are grouped. Defaults:

| Group | Setting | Default |
|---|---|---|
| Follow-ups on offers | First follow-up after an offer (days) | 7 |
| | Repeat follow-ups every (days) | 7 |
| | Automatically move old offers to "No response" | off |
| | …after (days since the offer) | 30 |
| Premium | Default payment terms (days after inception) | 60 |
| | Grace before the first overdue-premium follow-up (days) | 0 |
| Claims | Large-loss threshold, USD (our share) | 250,000 |
| | Remind the handler after no reserve movement for (days) | 90 |

Days must be between 1 and 365 (0 to 365 for payment terms and grace). Click **Save settings**.

### AI

AI-assisted entry is **off** until you switch it on.

1. **Owner action first:** the provider key goes into Supabase → Edge Functions → Secrets (`ANTHROPIC_API_KEY`, and optionally `AI_PROVIDER` and `AI_MODEL`). It is never entered in the app.
2. On the **AI** tab, tick **Switched on**.
3. Choose the **Roles that may use it**. The default roles are admin, underwriter, finance and claims.
4. Set **Requests per user per day**. The default is 100, and answers from the cache do not count.
5. Click **Save**.

The usage log lists every request: when, user, kind (Submission document or Bordereau columns), status, file, tokens in and out. It never keeps the document or the answer. Search it with words such as `status:error|refused`, `kind:bordereau_mapping` or `date>=7d`.

Until both steps are done, the **Fill from document** button does not show.

### Scheduled jobs

- The **Daily follow-up job** runs every day at 08:15 Tashkent time. It:
  - creates repeat reminders;
  - flags expired offers;
  - if enabled, moves old offers to "No response".
- **Run now** starts it at once.
- The table lists each run: **Started**, **Trigger** (manual or scheduled) and **Result**.

### Demo data

Demo data is for training and showing the system. Its names start with «DEMO» and its numbers with DEMO-.

- **Load demo data** adds the demo set. It works only when no demo data is loaded.
- **Check links** confirms that no demo record is linked to a real one.
- **Delete all demo data** removes every demo record, including its schedules, receipts, follow-ups and documents. Real data is not touched. This cannot be undone, and you must confirm it.

## 3. Finding things

- The search bar searches the list you are on, including each Admin tab:
  - users: `role:underwriter|finance`, `inactive`;
  - reference data: `cargo`, `inactive`;
  - FX rates: `ccy:EUR|UZS, date>=2026-10-01`, `source:manual`.
- Press **Ctrl K** (⌘K on a Mac) to jump to the bar. `,` means AND, `;` means OR and `-` excludes. **Syntax help** shows examples.
- Chips show "Your search, as understood". The **Filters** button lets you pick values and click **Apply**.
- **Columns** shows or hides columns. **Export to Excel** exports exactly the rows your search shows.

## 4. Appearance

- **Language**: use the EN / RU / UZ button in the top bar.
- Click your name, then **Appearance**:
  - **Colour theme**: Grey, Blue, Green or Orange;
  - **Text size**: Normal or Large;
  - **Demo mode**.
- **Demo mode** is per user. It shows only demo data, and an amber banner offers **Leave demo mode**.
- Demo rows never count in real lists, totals, exports or daily jobs. A link between demo and real records is refused.

## 5. Good to know

- Deactivate people instead of deleting them.
- The AI key lives only in the server's secrets. The app only switches AI on or off.
- Imported bordereaux and their lines are never edited or deleted. Only **Delete all demo data** removes demo ones.
- Reserves and recoveries are append-only. Write-offs keep who, when and why.
