# Proposed architecture

## Stack

- Web: Next.js App Router + TypeScript for public club pages and role-specific workspaces.
- Database: PostgreSQL (managed, one database) with Prisma; tenant-owned rows always carry `organization_id`.
- Authentication: managed OIDC/Auth.js or Supabase Auth after tenant/guardian invitation flows are validated.
- Files: private object storage with short-lived signed links for waivers and documents.
- Email and SMS: a configured regional provider behind a queue; WhatsApp only through an approved business provider and explicit opt-in.
- Payments: keep the platform as a ledger first; integrate providers only after Jordan merchant availability, settlement, fees, refund and compliance validation.
- Hosting: managed Next.js hosting and managed PostgreSQL; no microservices for initial launch.

## SQL schema sketch

Use UUID keys, `timestamptz` instants, integer fils plus ISO currency code, foreign keys, tenant isolation in every query and immutable audit events. Enforce authorization in the server data layer and add PostgreSQL row-level security when the selected managed database supports it. No client-supplied organization ID is trusted.

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(), name text not null,
  default_locale text not null default 'ar', timezone text not null default 'Asia/Amman',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table organization_users (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null, role text not null check(role in ('owner','admin','finance','coach','guardian')),
  status text not null default 'active' check(status in ('invited','active','disabled')),
  created_at timestamptz not null default now(), primary key(organization_id,user_id)
);
create table seasons (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, starts_on date not null, ends_on date not null, status text not null check(status in ('draft','open','active','closed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(ends_on >= starts_on)
);
create index seasons_org_status on seasons(organization_id,status);
create table athletes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  given_name text not null, family_name text not null, birth_date date,
  status text not null default 'active' check(status in ('active','inactive','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index athletes_org_name on athletes(organization_id,family_name,given_name);
create table guardians (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid, full_name text not null, phone_e164 text not null, email text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,phone_e164)
);
create table athlete_guardians (
  athlete_id uuid not null references athletes(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  relationship text not null, is_primary boolean not null default false,
  consent_at timestamptz, created_at timestamptz not null default now(), primary key(athlete_id,guardian_id)
);
create table programs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete restrict, sport text not null, name text not null,
  age_min smallint, age_max smallint, fee_fils integer not null default 0, currency char(3) not null default 'JOD',
  capacity integer, status text not null check(status in ('draft','open','closed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(fee_fils >= 0)
);
create index programs_org_season on programs(organization_id,season_id,status);
create table registrations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  program_id uuid not null references programs(id) on delete restrict, athlete_id uuid not null references athletes(id) on delete restrict,
  status text not null check(status in ('submitted','needs_info','approved','waitlisted','rejected','withdrawn')),
  fee_snapshot_fils integer not null, currency char(3) not null default 'JOD', submitted_at timestamptz not null default now(),
  reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now(),
  unique(program_id,athlete_id), check(fee_snapshot_fils >= 0)
);
create index registrations_org_status on registrations(organization_id,status,submitted_at desc);
create table teams (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  program_id uuid not null references programs(id) on delete restrict, name text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(program_id,name)
);
create table team_memberships (
  team_id uuid not null references teams(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete restrict,
  starts_at date not null, ends_at date, created_at timestamptz not null default now(), primary key(team_id,athlete_id,starts_at)
);
create table facilities (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, address text, timezone text not null default 'Asia/Amman', status text not null default 'active',
  created_at timestamptz not null default now()
);
create table events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  team_id uuid references teams(id) on delete set null, facility_id uuid references facilities(id) on delete set null,
  title text not null, kind text not null check(kind in ('practice','match','tournament','club_event')),
  starts_at timestamptz not null, ends_at timestamptz not null, status text not null default 'scheduled',
  created_by uuid not null, created_at timestamptz not null default now(), check(ends_at > starts_at)
);
create index events_org_starts on events(organization_id,starts_at);
create table attendance (
  event_id uuid not null references events(id) on delete cascade, athlete_id uuid not null references athletes(id) on delete restrict,
  status text not null check(status in ('present','absent','excused','late')), note text,
  recorded_by uuid not null, recorded_at timestamptz not null default now(), primary key(event_id,athlete_id)
);
create table payment_records (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  registration_id uuid not null references registrations(id) on delete restrict, amount_fils integer not null,
  currency char(3) not null default 'JOD', method text not null check(method in ('cash','bank_transfer','cliq','card','other')),
  provider_reference text, status text not null default 'recorded' check(status in ('pending','recorded','reversed')),
  received_at timestamptz not null, recorded_by uuid not null, created_at timestamptz not null default now(), check(amount_fils > 0)
);
create index payments_org_received on payment_records(organization_id,received_at desc);
create table notification_preferences (
  guardian_id uuid not null references guardians(id) on delete cascade, channel text not null check(channel in ('email','sms','whatsapp','push')),
  consented_at timestamptz, revoked_at timestamptz, primary key(guardian_id,channel)
);
create table audit_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid not null, action text not null, entity_type text not null, entity_id uuid not null,
  metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index audit_org_created on audit_events(organization_id,created_at desc);
```

Production additions: message threads and messages, consent evidence and versions, fee plans/installments, waivers and private document links, recurring schedule templates, waitlists and registration form versions, and provider webhook inboxes with idempotency keys.

## Route map

| Method / path | Caller | Purpose |
|---|---|---|
| `POST /api/orgs` | signed-in user | Create organization and owner membership |
| `GET /api/orgs/:orgId/overview` | admin/finance | Season aggregates, alerts and next events |
| `POST /api/orgs/:orgId/seasons` | owner/admin | Create season |
| `POST /api/orgs/:orgId/programs` | owner/admin | Configure program and fee |
| `POST /api/public/:orgSlug/registrations` | guardian | Submit registration, consent version and guardian relationship |
| `GET /api/orgs/:orgId/registrations` | admin | Paginated queue with server-side filters |
| `PATCH /api/orgs/:orgId/registrations/:id` | admin | Approve, waitlist or request information with audit event |
| `POST /api/orgs/:orgId/teams` | admin | Create team and coach grant |
| `POST /api/orgs/:orgId/events` | admin/coach | Schedule practice or match after conflict check |
| `PUT /api/orgs/:orgId/events/:id/attendance` | assigned coach/admin | Upsert roster attendance |
| `POST /api/orgs/:orgId/registrations/:id/payments` | finance/admin | Record a manual or provider-confirmed payment with idempotency key |
| `GET /api/guardians/me/athletes/:id/schedule` | linked guardian | Read upcoming events for linked athlete |
| `POST /api/orgs/:orgId/messages` | admin/assigned coach | Create message for an authorized audience; delivery queued by consent preference |
| `POST /api/webhooks/:provider/payments` | provider signature | Idempotently reconcile payment status |
| `GET /api/orgs/:orgId/audit` | owner/admin | Review sensitive changes |

## Hard parts and build order

1. Identity, tenant isolation, guardian-to-athlete linkage and role grants.
2. Registration plus season/program/roster lifecycle.
3. Schedule conflict rules and Asia/Amman timezone handling.
4. Money ledger and reconciliation; don't claim funds are collected until a provider/bank fact confirms it.
5. Child privacy, notification consent, deletion/export and audit trails.

Milestone 1: persistent vertical slice for club setup → season/program → guardian submission → admin review → team assignment. Milestone 2: event scheduling and attendance. Milestone 3: fee ledger and audited payment recording. Milestone 4: consent-based messages and family mobile views. Milestone 5: facility booking, club sites and competition tools.
