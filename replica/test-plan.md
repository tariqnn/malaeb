# Local QA matrix

Browser cases run against a disposable SQLite database on `127.0.0.1:4174`; they do not alter the live Wi-Fi database.

- F01-H1: Submit athlete, guardian, phone and consent; receive a reference and a saved review-queue row.
- F01-E1: Continue with required fields empty; stay on the current step with browser validation.
- F01-E2: Go back from review; guardian values remain present.
- F01-N1: Submit a second active application for the same athlete/program; API returns HTTP 409.
- F02-H1: Approve a pending registration; status changes and athlete appears with fees still due.
- F02-E1: Filter every status, including Declined.
- F03-H1: Save an event and verify it appears in the schedule.
- F04-H1: Record Cash or CliQ and verify the JOD ledger and receipt.
- F05-H1: Save a message into the selected local thread and reload it.
- F06-H1: Select a session, record attendance and verify saved values.
- F07-H1: Request a facility slot and approve/decline it from the request list.
- F08-H1: Create a program and team, assign a roster, and verify persistence.
- F09-R1: Render all routes at 320, 360, 390, 768, 1024 and 1440 CSS pixels without horizontal viewport overflow or uncaught browser errors.
- F10-A1: Run axe WCAG 2.1 A/AA on family registration at phone and desktop widths.

Not automated yet: refresh mid-registration, offline handling, concurrent administrators, manual screen-reader/keyboard walkthrough, calendar conflict rules, external message delivery, and real payment integrations.
