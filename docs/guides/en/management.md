# MIG Inward Re — Management guide

This guide is for management. Your role reads everything: the dashboards, every register and every record. It changes almost nothing.

## 1. What you see and what you can change

You start on the **Dashboard**. Your menu has **Dashboard**, **Submissions**, **My agenda**, **Binders**, **Claims**, **Receivables**, **Receipts** and **Counterparties**.

- You can **read** all submissions, premium, receipts, claims, binders and bordereaux.
- You can **close or reschedule the follow-ups assigned to you**, such as large-loss and capacity alerts.
- You cannot create or edit submissions, receipts, claims or binders. Those buttons are not shown to you.
- AI-assisted entry is not switched on for management by default.

## 2. Everyday tasks

### Read the dashboard

Choose the year under **Period**, or **All years**. The first part covers submissions:

- **Received this month**, **Under review**, **Awaiting answer**, **Overdue follow-ups** and **Bound in** the year (our gross);
- the **Status funnel** (Received → Reviewed → Offered → Bound) and the **Hit ratio**;
- **Bound premium by month**, **Our bound premium by MGA** and **Our bound premium by line** (USD);
- **Awaiting answer — age** and **Oldest unanswered offers**.

The **Premium** section shows:

- **Premium outstanding** (with the amount not yet due) and **Overdue premium**;
- **Received this month** and **Received in** the year;
- **Overdue premium by age**, **Top MGAs by overdue premium** and **Most overdue premium**.

Items with no FX rate are left out of USD totals and counted under the tiles.

The **Claims** section shows:

- **Open claims**, **Outstanding reserves**, **Paid in** the year and **Incurred** in the year (losses in the year);
- **Large losses** and **Cash calls due**.

The **Binders** section shows:

- **Active binders**, **Bordereaux missing**, **Received late** and **Capacity alerts** (80 % of the aggregate or more);
- the lists **Bordereaux to chase** and the binders near capacity.

Click any figure to open the register, filtered to exactly the rows behind it. The register shows the same total.

### Loss ratios

1. In the Claims section, under **Loss ratios**, use **Group loss ratios by** to choose MGA, Line of business or Underwriting year.
2. Read the two ratios:
   - **Loss ratio, incurred / written**: written = our signed net premium of bound risks.
   - **Loss ratio, incurred / earned**: earned = written × the part of the risk period that has run, counted day by day.
3. All figures are our share in USD. Incurred = paid + outstanding − recoveries.

A counterparty's page also shows its own **Premium** and **Claims** cards, with both loss ratios.

A binder's page shows its own **Loss ratio**: incurred / the binder submission's premium (our share, gross), in the binder currency.

### Large losses and capacity alerts

- A claim whose our share reaches **USD 250,000** (the default threshold) is marked **Large loss**. Management and admin each get a follow-up.
- When a binder uses **80 %** and again **100 %** of its aggregate, management and the binder's underwriter each get a **Capacity alert** follow-up, once per level.
- These follow-ups appear in **My agenda**. Close one with **Done** and an **Outcome**.

### Look at someone else's agenda

In **My agenda**, type `assignee:` followed by a name in the search bar, or `assignee:all` for everyone's follow-ups.

### Read the registers

- **Submissions**: every submission, with its status, premium and next follow-up.
- **Receivables**: what MGAs owe, by age in USD (0-30, 31-60, 61-90, 90+ days), with the payable return premium kept apart.
- **Receipts**: the money received and what each receipt paid.
- **Claims**: our share of reserves, payments, recoveries and incurred.
- **Binders**: capacity used, and bordereaux missing or late.

Click a row to open the record. Submissions, claims and binders have a **Change log** tab that shows who changed what, and when.

### Export

**Export to Excel** on each register exports exactly the rows your search shows. Narrow the search first, then export.

## 3. Finding things

- The search bar searches the list you are on. Press **Ctrl K** (⌘K on a Mac) to jump to it. On the dashboard it searches submissions, and Enter opens the register.
- Type words, or filters such as `status:bound`, `mga:"Silk Road"`, `overdue>45`, `large`, `capacity>=80`, `missing`. `,` means AND, `;` means OR and `-` excludes.
- **Syntax help** under the suggestions shows examples for each page. Filter words work in English, Russian and Uzbek.
- Chips under the title show "Your search, as understood". Click the × on a chip to remove that part.
- The **Filters** button lets you pick values and click **Apply**. The search then appears in the bar.
- **Columns** shows or hides table columns. **Reset to default** brings back the standard set.
- **Quick view** opens a submission in a side panel. Receipts and bordereaux open in side panels too.

## 4. Appearance

- **Language**: use the EN / RU / UZ button in the top bar.
- Click your name, then **Appearance**:
  - **Colour theme**: Grey, Blue, Green or Orange;
  - **Text size**: Normal or Large (every text one step bigger);
  - **Demo mode**.
- Your choices are saved to your profile and apply on every device.
- **Demo mode** is a separate practice world. You see only demo data (names start with «DEMO»). Real data, real totals and real exports are hidden while it is on. An amber banner reminds you; click **Leave demo mode** to go back. Demo figures never appear in real dashboards.

## 5. Good to know

- Every dashboard figure opens the register behind it, with the same total.
- Return premium is shown as payable to MGAs. It is never deducted from receivables.
- USD figures use the stored rate on the day. Items with no rate are counted, not guessed.
- "Incurred in the year" means losses with a date of loss in that year. "Paid in the year" means payments dated in that year.
- Reserves, recoveries and imported bordereaux are never edited. Corrections appear as new entries.
