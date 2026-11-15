# Build log

| Screen | Status | Implemented | Remaining |
|---|---|---|---|
| S01 Overview | Partial | SQLite-backed club counts, revenue totals, attendance totals, programs, upcoming sessions and activity shell. | Replace remaining illustrative chart/activity figures with queries; add date/season filters. |
| S02 People & families | Partial | Search, local athlete creation, guardian contact, program and fee status. | Edit/archive/detail view, guardian accounts, server-side paging. |
| S03 Registration | Partial | Parent application form, guardian consent timestamp, review queue, approve/waitlist/decline endpoints, approval creates/links an athlete and roster. | Form builder, waivers, duplicate/family merge and real message delivery. |
| S04 Teams & rosters | Partial | Persistent team creation, program membership, roster assignment. | Coach accounts, drag reorder, player transfer history. |
| S05 Schedule | Partial | Persistent event create/list with team, facility, date and time. | Month/week calendar grid, recurrence, conflict checks across all event sources, calendar export. |
| S06 Attendance | Partial | Per-event roster attendance persisted with status and audit entry. | Coach role, offline workflow, parent visibility, late arrival reason. |
| S07 Fees & payments | Partial | JOD ledger entries with receipts, supported manual method labels and local totals. | Installments, void/reversal, family statements, reconciliation and live provider integration. |
| S08 Messages | Partial | Persistent local threads and messages. | Delivery, preferences, consent, attachments, unread state. |
| S09 Facilities | Partial | Facility catalog and duplicate-time request check. | Availability rules, recurring slots, approval and booking calendar. |
| S10 Club website | Partial | Local club profile read/update and publish flag. | Public profile route, public content/SEO editor, custom domains. |

Build follows the glass-cards material cues while retaining original Malaeb structure, colors, content and code. Local-only security limits are documented in `README.md` and `backend.md`.


## 2026-11-15 bright UI and workflow pass

- Reworked the visual skin to a light Apple-inspired palette with blue/violet accents, translucent surfaces, selective blur, gentle spatial entrance/press motion, and reduced-motion support.
- Replaced hard-coded People and Teams totals with values from the local SQLite snapshot; athlete search filters live rows, and athlete/team detail sheets read saved records.
- Wired registration tabs to filter review status, added a decline choice, replaced the example registration URL with the current local `/#join` route, and made payment receipt rows open a printable local receipt.
- Remaining product work is intentionally called out above: local-only single-club operation, auth/permissions, real delivery/payment providers, calendar conflict and recurrence rules, facility approval/availability, and final Arabic/native-speaker QA. This is a complete local demo workflow, not a production launch build.

- Registration polish pass: three-step athlete/guardian/review wizard; accessible field constraints; session draft preservation; duplicate application rejection at the API and a SQLite partial unique index; confirmation reference; decline filter and bilingual family UI.
