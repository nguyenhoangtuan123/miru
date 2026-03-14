BEGIN;

ALTER TABLE assignments
    ADD COLUMN IF NOT EXISTS checklist_items JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS checked_item_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS completion_notes TEXT,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS near_due_reminded_at TIMESTAMPTZ;

UPDATE assignments
SET checklist_items = '[]'::jsonb
WHERE checklist_items IS NULL;

UPDATE assignments
SET checked_item_ids = '[]'::jsonb
WHERE checked_item_ids IS NULL;

UPDATE assignments
SET completion_notes = client_feedback
WHERE completion_notes IS NULL
  AND client_feedback IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_due_status
    ON assignments(status, due_date);

COMMIT;
