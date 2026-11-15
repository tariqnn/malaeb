PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS organization (
  id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Amman', timezone TEXT NOT NULL DEFAULT 'Asia/Amman',
  locale TEXT NOT NULL DEFAULT 'en', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
  -- JOD amounts are integer fils: 1 JOD = 1,000 fils.
  sport TEXT NOT NULL, age_group TEXT NOT NULL, fee_fils INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 30, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT, athlete_name TEXT NOT NULL, age INTEGER NOT NULL,
  program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
  guardian_name TEXT NOT NULL, guardian_phone TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Pending','Overdue','Inactive')),
  fee_fils INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS members_name_idx ON members(athlete_name);
CREATE INDEX IF NOT EXISTS members_status_idx ON members(status);
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, athlete_name TEXT NOT NULL, age INTEGER NOT NULL,
  program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
  guardian_name TEXT NOT NULL, guardian_phone TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Needs review' CHECK(status IN ('Needs review','Approved','Waitlist','Declined')),
  consent_at TEXT, submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS registrations_active_applicant_idx ON registrations(lower(athlete_name), program_id) WHERE status IN ('Needs review','Approved');
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
  coach_name TEXT NOT NULL DEFAULT 'Coach', coach_initials TEXT NOT NULL DEFAULT 'C',
  players INTEGER NOT NULL DEFAULT 0, facility TEXT NOT NULL DEFAULT 'Main pitch', next_session TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS team_memberships (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(team_id,member_id)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL, facility TEXT NOT NULL DEFAULT 'Main pitch',
  event_type TEXT NOT NULL DEFAULT 'Practice' CHECK(event_type IN ('Practice','Match','Other')),
  starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS events_starts_idx ON events(starts_at);
CREATE TABLE IF NOT EXISTS attendance (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('Present','Absent','Excused','Late')),
  note TEXT NOT NULL DEFAULT '', recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id, member_id)
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  family_name TEXT NOT NULL, athlete_name TEXT NOT NULL DEFAULT '', amount_fils INTEGER NOT NULL CHECK(amount_fils > 0),
  currency TEXT NOT NULL DEFAULT 'JOD', method TEXT NOT NULL CHECK(method IN ('Cash','CliQ')),
  note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Recorded' CHECK(status IN ('Recorded','Reversed')),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, receipt_code TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS payments_received_idx ON payments(received_at DESC);
CREATE TABLE IF NOT EXISTS message_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, audience TEXT NOT NULL DEFAULT 'Team',
  preview TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender TEXT NOT NULL, body TEXT NOT NULL, sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS facilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, location TEXT NOT NULL DEFAULT 'Amman',
  sport TEXT NOT NULL DEFAULT 'Football', status TEXT NOT NULL DEFAULT 'Active'
);
CREATE TABLE IF NOT EXISTS facility_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL, booking_date TEXT NOT NULL,
  starts_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Requested', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS club_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1), display_name TEXT NOT NULL, slug TEXT NOT NULL DEFAULT 'amman-ac',
  tagline TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0, locale TEXT NOT NULL DEFAULT 'en'
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL DEFAULT 'Local administrator',
  action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER,
  details TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log(created_at DESC);
