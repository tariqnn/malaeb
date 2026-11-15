# Reproduced bugs

| ID | Severity | Steps | Expected | Actual | Status |
|---|---|---|---|---|---|
| QA-001 | S2 | Open a pending registration and select a decision. | Decision saves and queue refreshes. | Review buttons are inserted after page handlers bind, so no handler receives the click. | Open |
| QA-002 | S2 | Use admin search, profile, notification and help controls. | Each visible control has a useful action. | Several controls have no action; the team detail icon has no action attribute. | Open |
| QA-003 | S2 | Switch to Arabic and inspect navigation and page labels. | Arabic is legible. | Legacy Arabic strings are mojibake. | Open |
| QA-004 | S2 | Open workspace routes at 320px. | No horizontal page overflow. | Base body minimum width is 360px. | Open |
| QA-005 | S3 | Search athletes and open a record. | Search retains the local record detail actions. | Search can replace custom rows with legacy demo rows. | Open |
| QA-006 | S3 | Open a payment receipt. | One detail view opens for the clicked receipt. | Legacy and local handlers can both react. | Open |
| QA-007 | S3 | Compare home totals with SQLite after a change. | All data counts reflect saved records. | Some overview activity/chart and sidebar figures are static. | Open |

Items remain provisional until reproduced in the browser run; update each row with evidence and fix status.
