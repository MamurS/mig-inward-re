# Design review v2 — after the UI review fixes (RU, grey theme, normal text, 1440×900)

Same 48 screens, same setup and order as `../demo/` (the review), taken after the
fixes in MamurS/mig-inward-re#11, so the two folders can be compared file by file.

Captured 2026-10-30 (v2) from the app's production build against the offline test
backend (`e2e/support/mockSupabase.ts`), signed in as an admin, Demo mode on
(banner «DEMO … Выйти из демо-режима»; names «DEMO …», numbers «DEMO-…» — as
in the real demo seed). Full-page captures show the whole page: the window is
grown to the content height, so sticky bars sit at the bottom.

Notes for reviewers:
- Date fields now use the app's own picker: дд.мм.гггг in RU / UZ.
- The demo figures follow the calibrated demo data (loss ratios 20–90 %, Silk Road ~120 % earned; Georgian Mineral Water Exporters).
- Binder references (dashboard «Биндеры» section) appear without «DEMO-»: the
  test backend keeps its binders outside the demo world.
- The chips example uses `Tashkent, -declined` (the demo portfolio has no «Sevil»).

| file | what it shows |
|---|---|
| 01-login.png | Login page, signed out |
| 02-dashboard.png | Dashboard, whole page (pipeline, premium, claims, binders, offers, charts) |
| 03-submissions-register.png | Submissions register (all 22 demo submissions) |
| 04-submissions-search-suggestions.png | Search bar open with status suggestions while typing `Tashkent, статус:` |
| 05-submissions-filter-builder.png | Filter builder open over the register |
| 06-submissions-query-chips.png | Query `Tashkent, -declined` applied: chips and filtered rows |
| 07-submission-quick-view.png | Quick-view side panel from a register row |
| 08-submission-bound-main.png | Bound submission (Tashkent City Mall): main data, follow-ups, first tab |
| 09-submission-bound-tab-premium.png | Same, Premium tab (schedule, receipts, return premium) |
| 10-submission-bound-tab-claims.png | Same, Claims tab |
| 11-submission-bound-tab-timeline.png | Same, Status timeline tab |
| 12-submission-bound-tab-documents.png | Same, Documents tab |
| 13-submission-bound-tab-change-log.png | Same, Change log tab |
| 14-submission-offered.png | Offered submission (Riyadh Logistics Hub) |
| 15-submission-declined.png | Declined submission (Ferghana Textile Mills) |
| 16-new-submission-empty.png | New submission form, empty |
| 17-new-submission-validation-errors.png | Same form after «Создать заявку» with missing fields: errors and the footer count |
| 18-status-dialog-make-offer.png | Status dialog «Сделать предложение» (share, validity) |
| 19-status-dialog-mark-bound.png | Status dialog «Подтвердить (bound)» (signed share, confirmation document) |
| 20-premium-schedule-editor.png | Premium schedule editor side panel, 4 equal installments |
| 21-premium-add-additional.png | Add additional premium dialog |
| 22-premium-add-return.png | Add return premium dialog |
| 23-premium-write-off-dialog.png | Write-off dialog on an overdue installment |
| 24-receipts-register.png | Receipts register |
| 25-receipt-detail.png | Receipt detail side panel (allocations) |
| 26-new-receipt-cross-currency.png | New receipt: USD paid against a EUR installment, live conversion preview |
| 27-receivables.png | Receivables register with ageing |
| 28-receivables-bucket-90plus.png | Receivables filtered `bucket:90+` |
| 29-agenda-open.png | Agenda (My follow-ups), open |
| 30-agenda-done.png | Agenda, Done (last 30 days) tab |
| 31-counterparties.png | Counterparties list |
| 32-counterparty-mga-page.png | MGA page (Silk Road Underwriting Agency): details, submissions, premium, claims |
| 33-new-counterparty.png | New counterparty form |
| 34-admin-users.png | Admin › Users & roles |
| 35-admin-reference.png | Admin › Reference data |
| 36-admin-fx.png | Admin › FX rates |
| 37-admin-settings.png | Admin › Settings |
| 38-admin-demo.png | Admin › Demo data (counts, check links, delete) |
| 39-appearance-menu.png | Appearance dialog open (themes, text size, Demo mode) |
| 40-dashboard-blue.png | Dashboard, blue theme |
| 41-submission-detail-blue.png | Bound submission, blue theme |
| 42-dashboard-green.png | Dashboard, green theme |
| 43-submission-detail-green.png | Bound submission, green theme |
| 44-dashboard-orange.png | Dashboard, orange theme |
| 45-submission-detail-orange.png | Bound submission, orange theme |
| 46-dashboard-uz-large.png | Dashboard in Uzbek, Large text |
| 47-submissions-uz-large.png | Submissions register in Uzbek, Large text |
| 48-submissions-1280x800.png | Submissions register at 1280×800 |
