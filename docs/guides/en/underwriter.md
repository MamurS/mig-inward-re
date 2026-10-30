# MIG Inward Re — Underwriter guide

This guide is for underwriters. It shows how to register submissions, move them through their statuses, set up premium schedules, and work with binders and bordereaux.

## 1. What you see and what you can change

You start on **Submissions**. Your menu has **Submissions**, **My agenda**, **Binders**, **Claims** and **Counterparties**. The Dashboard, Receivables and Receipts are not available to your role.

You can:

- create and edit submissions, and change their status;
- create and change the premium schedule of **your own** bound submissions, and add additional or return premium to it;
- upload documents to submissions and binders, and add follow-ups to them;
- create and edit binders, and upload **risk** bordereaux;
- add counterparties (MGAs, brokers, cedents) and edit their details and contacts.

You can **read** the claims on your own risks only. Receipts, write-offs and claim payments are finance work.

## 2. Everyday tasks

### Register a new submission

1. Click **New submission** on the Submissions page.
2. Fill in the required fields: **Received**, **MGA**, **Received from**, **Insured** and **Currency**. The bar at the bottom shows "Required: x of y".
3. Leave **Broker** empty if the MGA sent the submission directly.
4. If the MGA or broker is new, click the **+** button next to the field (**New MGA** / **New broker**) and add them.
5. Choose the **Business type**: *Facultative* or *Binder*. For *Binder*, pick the MGA's binder in the **Binder** field.
6. **Payment terms (days)** is filled in with 60. Change it if the slip says otherwise.
7. **Signed share %** stays empty. It is set when the submission is bound.
8. Check the **Our share — live figures** panel, then click **Create submission**.

### Fill from document (AI)

The **Fill from document** button appears only when an admin has switched AI on for your role.

1. Click **Fill from document**. Under **Read from**, choose **A file** (PDF, image or text, up to 8 MB) or **Pasted text**.
2. Click **Read with AI**. Each field shows a value, a confidence badge ("AI … %") and the text it came from.
3. Low-confidence values are not ticked. Tick only the values you want to use.
4. A name marked "not in Counterparties" is not filled in. Add the counterparty first, then pick it.
5. Read the **Already in the register? Similar submissions:** list. It is only a warning. You decide.
6. Click **Fill N fields**. The filled fields are marked until you change them. **Hide marks** removes the marks.
7. **Nothing is saved until you click Create submission (or Save changes).**

### Change the status

You change the status only with the buttons on the submission page:

| Status now | Buttons |
|---|---|
| Received | **Start review** |
| Under review | **Make offer**, **Decline** |
| Offered | **Mark bound**, **Not taken up (NTU)**, **No response** |
| No response | **Mark bound**, **Not taken up (NTU)** |
| Bound, Declined, NTU | final: no more changes |

- **Make offer** needs a **Written share %** (above 0, at most 100) and an **Offer valid until** date (today + 30 days is suggested). A follow-up reminder is created for you automatically.
- **Decline** and **Not taken up (NTU)** need a **Reason**.
- **Mark bound** needs a **Signed share %** above 0. It can be lower than the written share, but never higher.
- To bind, also attach a **Confirmation document**: choose one already uploaded, or upload a file. If you have no document yet, tick "I confirm binding without a confirmation document (attach it later)."
- After binding, the page opens the **Premium** tab and the schedule editor.

### Set up the premium schedule

1. On a bound submission, open the **Premium** tab. Click **Create premium schedule**.
2. Under **How it is paid**, choose **One installment**, **Equal installments** (number of installments, at least 2; first due date; every month, quarter or half-year) or **Custom** (**Add installment**).
3. Commission and brokerage are deducted from each installment: net = gross − commission − brokerage.
4. If the total differs from the expected premium, you can still save. The difference stays visible.
5. If the signed share changes later, a "no longer matches" warning appears with **Regenerate schedule**. You cannot regenerate once receipts are allocated. Use **Add additional premium** or **Add return premium** instead.

Default due date for one installment: the PPW date; if there is none, inception + the payment terms; if there are no terms, inception + 60 days.

### Documents

1. Open the **Documents** tab. Drop files, or click to choose them (up to 50 MB per file).
2. Choose the **Document type** for each file, then click **Upload (n)**.

You can delete only your own uploads. A document marked **Confirmation evidence** can never be deleted.

### Follow-ups and My agenda

- On a submission, click **Add follow-up**. Choose the **Type** (Request update, Offer expiry, Other), the **Due** date (7 days ahead by default), a **Title** and **Assigned to**.
- **My agenda** lists your open follow-ups, overdue first, under: Overdue, Due today, Next 7 days, Later. The **Done (last 30 days)** tab shows what was closed.
- To close a follow-up, click **Done**. Write the **Outcome** (required). Tick **Schedule another follow-up** to set the next one.
- Use **Reschedule / reassign** to move a follow-up to another date or person.

### Binders and bordereaux

- **New binder** (Binders page) opens a side panel. Enter the **Binder ref.**, MGA, broker, underwriter, inception and expiry dates, currency, **Our share, %**, commission and brokerage, the **Limit per risk** and the **Aggregate limit**.
- Then tick the **Lines of business** (each can have its own limit) and the **Territories** (none ticked = anywhere). Set the **Bordereaux** (Monthly or Quarterly), the **Kinds owed** and **Due, days after the period** (30 = 30 days after the month or quarter ends). Click **Create binder**.
- To upload a bordereau, click **Upload bordereau** on the binder page, or **Upload** in a missing cell of **Bordereaux by period**:
  1. **File and period**: choose the **Kind**, **Period** and **Received on** date, then the file (.xlsx or .csv, up to 10 MB and 5,000 rows).
  2. **Columns**: the MGA's **Saved mapping** is applied if there is one. Check each **Our field** against its **Column in the file**. You can use **Suggest with AI** and **Save this mapping for the MGA**.
  3. **Check and import**: lines with errors are left out. Each warning needs a comment. Enter the **MGA's stated total**; if it differs from the lines' total, write why.
  4. Click **Import N lines**. The original file is kept with the bordereau.
- Risk lines count toward the binder's capacity. When 80 % and 100 % of the aggregate is used, management and the binder's underwriter get a follow-up.
- When a bordereau is past its due date, a daily job gives the binder's underwriter a **Bordereau missing** follow-up.

### Counterparties

- To add one, click **New counterparty** and enter the **Type**, **Name** and **Country**. A name that already exists for the same type is refused.
- On the counterparty page, use **Edit details** to change it, and **Add contact** to add people.

## 3. Finding things

- The search bar at the top searches the list you are on. Press **Ctrl K** (⌘K on a Mac) to jump to it.
- Type words, or filters such as `status:offered|bound`, `mga:"Silk Road"`, `expiry<30d`, `overdue`, `mine`. `,` means AND, `;` means OR and `-` excludes. **Syntax help** shows examples.
- Chips under the title show "Your search, as understood". Click the × on a chip to remove that part.
- The **Filters** button (at the right end of the bar) lets you pick values and click **Apply**. The search then appears in the bar.
- **Columns** shows or hides table columns. **Export to Excel** exports exactly the rows your search shows. You can also tick rows and use **Export selected**.
- **Quick view** (the eye icon in a row) opens a submission in a side panel.

## 4. Appearance

- **Language**: use the EN / RU / UZ button in the top bar.
- Click your name, then **Appearance**:
  - **Colour theme**: Grey, Blue, Green or Orange;
  - **Text size**: Normal or Large;
  - **Demo mode**.
- **Demo mode** is a separate practice world. You see only demo data (names start with «DEMO»), and real data is hidden. An amber banner stays at the top; click **Leave demo mode** to go back. What you create in demo mode stays demo. Demo and real records never mix.

## 5. Good to know

- The status changes only through the action buttons. Bound, Declined and NTU are final.
- The signed share can never be higher than the written share.
- Imported bordereaux and their lines are never edited or deleted. A correction comes in the next bordereau.
- Premium and claims bordereaux are uploaded by finance and claims, and only after the binder's submission is bound.
- AI only suggests. You check every field, and nothing is saved until you save the form.
