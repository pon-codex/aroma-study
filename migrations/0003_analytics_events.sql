CREATE TABLE analytics_events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'app_view',
    'quiz_start',
    'upgrade_view',
    'checkout_start',
    'checkout_error',
    'purchase_success',
    'restore_request',
    'restore_success'
  )),
  event_context TEXT,
  event_value TEXT,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  path TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_analytics_events_name_created
  ON analytics_events(event_name, created_at);
CREATE INDEX idx_analytics_events_session
  ON analytics_events(session_id, created_at);
CREATE INDEX idx_analytics_events_source
  ON analytics_events(source, created_at);

PRAGMA optimize;
