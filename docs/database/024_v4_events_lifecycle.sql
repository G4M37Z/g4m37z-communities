-- V4 Event Lifecycle Enhancement
ALTER TABLE events
ADD COLUMN IF NOT EXISTS lifecycle_state TEXT DEFAULT 'draft' CHECK (lifecycle_state IN ('draft','published','live','completed','cancelled')),
ADD COLUMN IF NOT EXISTS max_attendees INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS event_image_url TEXT;
CREATE INDEX IF NOT EXISTS idx_events_lifecycle ON events(lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_events_pinned ON events(is_pinned) WHERE is_pinned = TRUE;
