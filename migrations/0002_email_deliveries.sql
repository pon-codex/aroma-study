CREATE TABLE email_deliveries (
  delivery_key TEXT PRIMARY KEY,
  email_type TEXT NOT NULL,
  recipient TEXT NOT NULL COLLATE NOCASE,
  status TEXT NOT NULL CHECK (status IN ('sending', 'delivered')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_email_deliveries_recipient
  ON email_deliveries(recipient, email_type);

PRAGMA optimize;
