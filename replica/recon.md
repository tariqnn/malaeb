# Malaeb product recon

## Product decision

Build an original club operations platform for youth and community sports organizations in Jordan. First surface: responsive administrator web workspace. Include Arabic and English presentation, correct RTL behavior, JOD as the displayed currency, Asia/Amman local time, guardian-first athlete records, and local club operations. A companion parent/athlete mobile experience is a later surface.

## Public sources

| Source | What was observed | URL |
|---|---|---|
| TeamSnap marketing site | Positions TeamSnap ONE as organization operations with registration, payments, rosters, schedules, communications and a connected coach/family app; TeamSnap Classic covers individual team rosters, schedules, messaging and practice plans. | https://www.teamsnap.com/ |
| TeamSnap organization pages | Registration/payments, team and league schedules, and live streaming are separate product areas. | https://www.teamsnap.com/ |
| SportsEngine HQ marketing page | Direct fetch returned HTTP 403 in this research session. No claims are inferred from access to private pages. | https://www.sportsengine.com/hq/ |
| SportsEngine HQ help center search results | Public article snippets and titles identify financial settings/reports, admins, registration, websites, season setup, member management, team rosters and schedules. | https://help.sportsengine.com/en/articles/9066921-getting-started-with-sportsengine-hq |
| SportsEngine registration FAQ | Public result identifies registration and payment-plan support; family-specific event details are owned by each organization. | https://help.sportsengine.com/en/articles/6304341-athlete-registration-faq |

## Core user loop

Club administrator configures a season and programs → family submits athlete and guardian details → administrator reviews and assigns a team → coach publishes sessions and takes attendance → family sees schedules and club updates → administrator records fees and reconciles balances.

## Screen inventory

| ID | Screen | Route | Purpose | Key components / states |
|---|---|---|---|---|
| S01 | Overview | `#overview` | Understand season health at a glance | season banner, athlete/registration/payment/attendance KPIs, revenue trend, activity, programs, upcoming sessions |
| S02 | People & families | `#members` | Find athlete/guardian records and fee status | searchable list, status chips, add-athlete form, empty state |
| S03 | Registration | `#registration` | Review new applications | tabs, season/program filters, applicant table, review action |
| S04 | Teams & rosters | `#teams` | Organize groups, coaches and players | team cards, next-session summary, roster action |
| S05 | Schedule | `#schedule` | Coordinate shared practices and matches | month grid, event type colors, upcoming list, add-event form |
| S06 | Attendance | `#attendance` | Mark attendance by session | attendance summary, team selector, present/absent/excused states |
| S07 | Fees & payments | `#payments` | Track balances and recorded payment methods | season metrics, transaction table, payment form, receipt references |
| S08 | Messages | `#messages` | Organize team/family conversations | thread list, conversation view, composer, new-message form |
| S09 | Facilities | `#facilities` | See facilities and request a slot | facility cards, utilization summary, booking form |
| S10 | Club website | `#website` | Manage public club information and registration | publish state, section list, bilingual profile summary |

## User flows

- F01 Add a family: Overview or People → Add athlete → enter athlete, age group, guardian, mobile, program → saved to current in-memory demo list. Release target adds guardian consent and duplicate checking.
- F02 Review a registration: Registration → choose season/status → open application → approve/waitlist/request information. Prototype shows review affordance only.
- F03 Coordinate practice: Schedule → Add event → select team, local date/time, event type → appears in persistent club calendar. Prototype shows success confirmation only.
- F04 Record a payment: Fees → Record payment → select family, JOD amount, method (cash, bank transfer, CliQ, card terminal), date → receipt/audit record. Prototype confirms only; no money movement.
- F05 Communicate: Messages → select team or family → compose → send to opted-in recipients via configured channel. Prototype adds a local thread message only.
- F06 Run a session: Schedule/Attendance → select team session → mark present, absent, excused → coach and family receive role-appropriate updates. Prototype demonstrates the state controls only.

## Feature matrix overview

See `features.csv`. Must-have release areas: seasons, programs, family registration, team/roster management, scheduling, attendance, fees ledger, bilingual family communication, role-based access, audit/history, data export, and privacy controls. Nice additions include public club websites, facility scheduling, livestreaming/video, analytics, tournaments and coach resources.

## Entities inferred

Organization, User, RoleGrant, Season, Sport, Program, Registration, Athlete, Guardian, GuardianAthlete, Team, TeamMembership, CoachAssignment, Facility, FacilitySlot, Event, Attendance, FeePlan, Invoice, PaymentRecord, MessageThread, Message, ConsentRecord, Notification, AuditEvent. Core person/child and fee fields are guesses until a Jordanian pilot partner validates actual paperwork and policies.

## Localization / operating assumptions to validate with pilot clubs

- Arabic and English; test Arabic names, mobile keyboard behavior, RTL tables and mixed Arabic/Latin numbers.
- Amounts stored as integer fils with ISO currency code `JOD`; presentation must use explicit `JOD` until local finance partners confirm preferred notation.
- Store event instants in UTC; render in `Asia/Amman`. Validate holidays, school terms and venue-specific schedules with pilot operators.
- Support guardian relationships, sibling profiles and club-issued family accounts; collect only data required by the club.
- Treat CliQ, cash and bank transfer as ledger labels until each payment provider, merchant eligibility, refund model, reconciliation and local compliance are verified.
- WhatsApp/SMS are not assumed to be available for marketing messages. Consent, opt-outs, approved sender setup, cost and delivery provider must be validated before launch.

## Out of scope to copy

Reference brands, logos, proprietary copy, assets, customer data, private APIs, network effects, licensing/streaming agreements, and payment/insurance relationships. Use original artwork and integrations through public/contracted APIs only.

## Size and risk

Full parity is XL (multiple products and a substantial backend). The dashboard prototype is a first design slice. Highest risks: child data and guardian authorization; local money collection/reconciliation; cross-role scheduling and reliable notifications. Next: confirm product name and recruit 2–3 Jordanian clubs for workflow discovery, then implement the first persistent vertical slice.
