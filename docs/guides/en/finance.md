# MIG Inward Re — Finance guide

This guide is for the finance team. It shows how to record the money MGAs pay, follow up what they still owe, and pay claims.

## 1. What you see and what you can change

You start on **Submissions**. Your menu has **Dashboard**, **Submissions**, **My agenda**, **Binders**, **Claims**, **Receivables**, **Receipts** and **Counterparties**.

You can:

- record **receipts** and allocate them to installments, remove an allocation and allocate what is left;
- **write off** an installment (and undo a write-off), and mark return premium as paid to the MGA;
- create or change the premium schedule of any bound submission, and add additional or return premium;
- record **claim payments**, by bank transfer or as an offset against premium;
- upload **premium** and **risk** bordereaux;
- close your team's follow-ups (Finance team).

You read submissions, binders, claims and counterparties, but you do not edit them.

## 2. Everyday tasks

### Record a receipt

1. Open **Receipts** and click **New receipt**.
2. Fill in **Received** (the date), **Payer** (an MGA, broker or cedent), **Currency** and **Amount**. Add the **Bank reference** and **Notes** if you have them.
3. Under **Allocate to installments**, the payer's open installments are suggested, oldest due first.
   - **Auto-allocate oldest first** fills each installment up to what fits.
   - **Max** fills one row.
   - **Add an installment from another payer…** adds any other open installment.
4. Watch the running total. It shows what is left unallocated, or how much you are over the receipt.
5. Click **Record receipt and N allocations**, or **Record receipt (unallocated)** if you will allocate it later.

The receipt and its allocations are saved together, or not at all. Receipts are numbered RCP-YYYY-NNNN.

### Allocate across currencies

- When the receipt and the installment are in different currencies, enter the rate: "Rate: X per 1 Y" (installment currency per 1 receipt currency).
- The rate is prefilled with the stored rate on the received date. **Use stored** puts it back.
- The preview shows what lands on the installment, and the rate both ways.
- **This looks inverted** appears when the rate is close to 1 ÷ the stored rate. "More than 10 % away from the stored rate" asks you to check it.
- You can never allocate more than is outstanding on the installment.

### Work on an existing receipt

1. Click a receipt in the register. A side panel shows what it paid.
2. **Remove allocation** makes the installment unpaid by that amount again.
3. **Allocate the remaining …** allocates the money that is left.

### Receivables and ageing

- **Receivables** lists every installment MGAs still owe, oldest due first.
- The tiles show amounts in USD: **Outstanding**, **Not yet due**, **0-30**, **31-60**, **61-90** and **90+ days**. Click a tile to filter the list by that bucket.
- Days overdue are counted in Tashkent time.
- Return premium is kept apart, in the **Payable to MGAs** tile. It is never deducted from what MGAs owe.
- Items with no FX rate are not in the USD totals. The page tells you how many there are.

### Write off an installment

1. In Receivables, click the ref. no. to open the submission. The **Premium** tab opens.
2. In the installment's row menu, choose **Write off**. Enter the **Reason** (required).
3. Writing off stops the overdue reminders. The row shows "Written off by …" with your name and the date.
4. **Undo write-off** reverses it.

### Return premium

When return premium has been paid back to the MGA, choose **Mark as paid to MGA** in its row menu and enter the date.

### Overdue premium follow-ups

- **Premium overdue** follow-ups go to the whole **Finance team**. Every finance user sees them in **My agenda**.
- The first one comes the day after the due date. The default grace is 0 days, and reminders repeat every 7 days.
- Any finance user can close one with **Done** and an **Outcome**. The agenda records who closed it.

### Pay a claim

1. Open the claim and click **Record payment**.
2. Under **Paid by**, choose **Bank transfer** or **Offset against premium**.
3. Choose the **Type** (Indemnity, Expense, Cash call), the **Amount** (our share, in the claim currency) and the **Payment date**. For a bank transfer, also enter the **Payee** and **Bank reference**.
4. **Offset against premium**: enter the amount first, then choose the MGA's open installments. The offset must be allocated in full. The app records a receipt from the MGA for the same amount.
5. Click **Save payment**. A cash-call payment closes the open cash-call follow-up.

You cannot record a payment on a closed or declined claim.

### Premium bordereaux

- On the binder page, click **Upload bordereau** and choose the kind **Premium**. The steps are the same as for any bordereau: **File and period** → **Columns** → **Check and import**.
- The import creates one premium installment per currency: our share of gross premium, with commission and brokerage deducted. It is due the binder's due days after the period ends. A negative total becomes return premium.
- The binder's submission must be bound first.

### Premium dashboard

On the **Dashboard**, the **Premium** section shows:

- **Premium outstanding** (with the amount not yet due);
- **Overdue premium**;
- **Received this month** and **Received in** the current year;
- **Overdue premium by age**, **Top MGAs by overdue premium** and **Most overdue premium**.

Every figure opens the filtered register. The **Claims** and **Binders** sections are shown too.

## 3. Finding things

- The search bar searches the list you are on. Press **Ctrl K** (⌘K on a Mac) to jump to it.
- Receivables words: `overdue>45`, `bucket:61-90|90+`, `mga:"Silk Road", overdue`, `due<30d`, `payable`, `status:written_off`.
- Receipts words: `unallocated`, `allocated`, `payer:`, `ccy:EUR`, `received>=2026-10-01`, `amount>10k`, or a receipt number.
- `,` means AND, `;` means OR and `-` excludes. **Syntax help** shows examples.
- Chips show "Your search, as understood". The **Filters** button lets you pick values and click **Apply**.
- **Columns** shows or hides columns. **Export to Excel** exports exactly the rows your search shows.

## 4. Appearance

- **Language**: use the EN / RU / UZ button in the top bar.
- Click your name, then **Appearance**:
  - **Colour theme**: Grey, Blue, Green or Orange;
  - **Text size**: Normal or Large;
  - **Demo mode**.
- **Demo mode** is a separate practice world with demo data only (names start with «DEMO», numbers with DEMO-). Real data is hidden while it is on. Click **Leave demo mode** in the banner to go back. Demo receipts can never pay real installments, and demo rows never count in real totals.

## 5. Good to know

- Return premium is payable. It is never netted against receivables.
- A write-off always needs a reason, and your name is kept with it.
- An offset must be allocated in full. A rate is needed across currencies.
- USD totals use the stored rate on the day. Items with no rate are left out of USD totals and counted.
- A premium schedule cannot be regenerated once money is allocated to it.
- Imported bordereaux are never edited or deleted.
