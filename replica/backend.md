# Local backend status

## Implemented

- Python 3 standard-library HTTP server, bound to `127.0.0.1` only.
- SQLite database created at `data/malaeb.sqlite3`; schema in `data/schema.sql`; first-run fiction-only seed data.
- JSON endpoints for bootstrap, athlete/member create, program create, team create, roster assignment, family registration, registration review, payments, events, attendance, messages, facility requests, profile updates, audit reads and health.
- Server-side validation for required fields, supported statuses/methods, duplicate active athlete/program entries, positive payments, guardian consent on family intake, and conflicting facility/time requests.
- Audit rows on record creation and review/update actions.
- Web client refreshes from SQLite after writes; table CSV is generated client-side from the local roster.
- Request-size cap and generic server errors; request logs omit submitted field values.

## Intentionally not connected

- No user authentication or authorization. The single local operator has all access.
- No cloud database or backup automation.
- No card processor, CliQ provider API, bank connection, refund workflow or settlement reconciliation. A recorded amount is only a local operator-entered ledger record.
- No external message delivery or opt-in system. Message content remains in local SQLite.
- No OAuth, file uploads, public hosting, telemetry or analytics.

## Required before real family or club data

- Add account authentication, secure session cookies, role checks on every route, and an organization/tenant ID on every record.
- Add guardian consent evidence and retention/deletion/export workflows designed with a Jordanian club and local counsel.
- Encrypt backups and define access, recovery, and deletion procedures.
- Add database migrations, transactional tests, concurrency protections, rate limiting, and security review.
- Validate the local payment ledger and selected provider against Jordan-specific settlement, fee, refund, and compliance requirements before taking payments.
- Verify message-provider terms, guardian channel consent, quiet hours, opt-outs, and sender setup before external notifications.
