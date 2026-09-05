-- SQLite-compatible schema for MedLens (development)
-- Mirrors db/schema.sql but uses SQLite-native types.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  email TEXT UNIQUE NOT NULL CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'clinician', 'customer')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  disabled_at TEXT
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  encrypted_profile TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS patients_owner_idx ON patients(owner_user_id);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  report_date TEXT,
  encrypted_source TEXT NOT NULL,
  source_label TEXT NOT NULL DEFAULT 'Patient uploaded report',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS reports_patient_date_idx ON reports(patient_id, report_date DESC);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  report_id TEXT REFERENCES reports(id),
  encrypted_observation TEXT NOT NULL,
  provenance TEXT NOT NULL CHECK (provenance IN ('patient_provided', 'report_extracted', 'ai_generated', 'clinician_verified')),
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  verified_by TEXT REFERENCES users(id),
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS observations_patient_idx ON observations(patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  encrypted_summary TEXT NOT NULL,
  provenance TEXT NOT NULL DEFAULT 'ai_generated' CHECK (provenance IN ('patient_provided', 'report_extracted', 'ai_generated', 'clinician_verified')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT REFERENCES patients(id),
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS audit_patient_idx ON audit_events(patient_id, created_at DESC);

-- SQLite trigger to enforce append-only audit events
CREATE TRIGGER IF NOT EXISTS audit_immutable_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS audit_immutable_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;
