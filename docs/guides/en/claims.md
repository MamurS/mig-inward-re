# MIG Inward Re — Claims guide

This guide is for the claims team. It shows how to register claims, keep reserves up to date, and close claims.

## 1. What you see and what you can change

You start on **Claims**. Your menu has **Dashboard**, **Submissions**, **My agenda**, **Binders**, **Claims** and **Counterparties**.

You can:

- create claims and change their status;
- edit claim details (handler, cause, location, cedent's ref., description);
- record **reserve movements** and **recoveries**;
- upload claim documents and add follow-ups to claims;
- upload **claims** and **risk** bordereaux.

Payments are recorded by finance. You see them on the claim. Submissions, binders and counterparties are read-only for you.

## 2. Everyday tasks

### Register a new claim

1. Open **Claims** and click **New claim**.
2. Under **Risk**, search the bound submissions by ref. no., insured or MGA, and pick one. Click **Another risk** to change it.
3. Fill in **Notified on** (today by default), **Date of loss** and **Currency**.
4. Fill in **Estimate (100 %)**. The app shows our share at the signed line.
5. Add the **Cause / peril**, **Location**, **Cedent's claim ref.**, **Description** and **Claims handler**.
6. The coverage check runs as you type:
   - "Cover checks out" means the risk is bound, the loss is inside the period, and the currency is the same.
   - Otherwise the check lists what it found:
     - the risk is not bound;
     - the risk has no period;
     - the loss is before inception or after expiry;
     - the date of loss is in the future;
     - the currency differs from the risk's.
   - To go on anyway, write a comment in **Why the claim goes ahead anyway**.
7. Click **Create claim**. Claims are numbered CLM-YYYY-0001.

Our share is the **signed line on the date of loss**.

### Change the status

| Status now | Buttons |
|---|---|
| Notified | **Open the claim**, **Decline the claim** |
| Open / Reopened | **Close the claim**, **Decline the claim** |
| Closed / Declined | **Reopen the claim** |

- Declining needs a **Reason for declining**.
- If money is still outstanding when you close, you must write a **Closing comment**, or first bring the outstanding to zero with a reserve movement.
- You cannot add a reserve or a payment to a closed or declined claim.

### Reserves

1. Click **Reserve movement**. Choose **Increase** or **Decrease**, then the **Amount** (our share, claim currency), the **Date** and the **Reason**.
2. The dialog shows "Outstanding after". Click **Save movement**.

Reserves are never edited. A correction is a new movement, and the full history stays in the **Reserve history** chart and list.

- **Outstanding** = reserves − payments.
- **Incurred** = paid + outstanding − recoveries.

### Recoveries

Click **Add recovery**. Choose the **Kind** (Salvage, Subrogation, Other), then the amount, date and notes. Click **Save recovery**. Recoveries reduce incurred.

### Large losses

- A claim is marked **Large loss** when our share reaches the large-loss threshold: **USD 250,000** by default (Admin › Settings).
- Our share is taken as the larger of the estimate and the reserves, at today's rate.
- Management and admin each get a follow-up.
- Nobody can set or clear the mark by hand.
- If there is no FX rate for the claim currency, the claim shows "No … rate yet: no USD figures", and the check cannot run.

### Follow-ups

- On a claim, click **Add follow-up**. Choose **Awaiting documents**, **Cash call due** or **Other**. Assign it to a person, the **Finance team** or the **Claims team**.
- A cash-call follow-up closes by itself when finance records the cash-call payment.
- If an open claim has had no reserve movement for **90 days**, a daily job adds a **Reserve review** follow-up. It goes to the handler, or to the claims team if there is no handler.

### Documents

On the claim's **Documents** tab, the document types are: Loss advice, Claim notice, Adjuster report, Proof of loss, Cash call request, Payment proof, Correspondence and Other.

### Claims bordereaux

1. On the binder page, click **Upload bordereau** and choose the kind **Claims**.
2. Go through **File and period** → **Columns** → **Check and import**. Warnings need a comment; lines with errors are left out.

What the import does:

- Each line finds its claim by the **Cedent's claim ref.**, or opens a new claim (status open).
- The reserve moves to our share of paid + outstanding.
- A bordereau never records a payment.
- The binder's submission must be bound first.

### Claims dashboard

On the **Dashboard**, the **Claims** section shows:

- **Open claims**, **Outstanding reserves**, **Paid in** the year and **Incurred** in the year (losses in the year);
- **Large losses** and **Cash calls due**.

Each figure opens the filtered register.

Under **Loss ratios**, use **Group loss ratios by** to choose MGA, Line of business or Underwriting year. Both ratios are shown: **incurred / written** and **incurred / earned**.

## 3. Finding things

- The search bar searches the list you are on. Press **Ctrl K** (⌘K on a Mac) to jump to it.
- Claims words: `status:open|reopened`, `large`, `cashcall`, `review` (no reserve movement for 90+ days), `mine`, `mga:`, `lob:`, `handler:`, `dol:2026-01-01..2026-06-30`, `outstanding>50k` (USD, our share).
- `,` means AND, `;` means OR and `-` excludes. **Syntax help** shows examples.
- Chips show "Your search, as understood". The **Filters** button lets you pick values and click **Apply**.
- **Columns** shows or hides columns. **Export to Excel** exports exactly the rows your search shows.

## 4. Appearance

- **Language**: use the EN / RU / UZ button in the top bar.
- Click your name, then **Appearance**:
  - **Colour theme**: Grey, Blue, Green or Orange;
  - **Text size**: Normal or Large;
  - **Demo mode**.
- **Demo mode** is a separate practice world with demo data only (names start with «DEMO»). Real data is hidden while it is on. Click **Leave demo mode** in the banner to go back. Demo claims never mix with real ones.

## 5. Good to know

- Reserves and recoveries are never edited or deleted. A correction is a new movement.
- A failed coverage check is a warning, not a block. It needs a comment.
- Payments are always in the claim currency, and they are recorded by finance.
- Closing with money outstanding needs a comment.
- The large-loss mark is set by the system only.
