-- ============================================================
-- Add email channel support to broadcasts
--
-- This enables unified campaigns across WhatsApp and email channels.
-- Existing broadcasts default to 'whatsapp' channel.
-- ============================================================

-- Add channels array column to broadcasts (supports multiple channels)
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS channels TEXT[] NOT NULL DEFAULT '{whatsapp}';

-- Add check constraint to ensure only valid channels
ALTER TABLE broadcasts
  ADD CONSTRAINT valid_channels CHECK (
    channels <@ ARRAY['whatsapp', 'email']
  );

-- Add email-specific fields to broadcasts
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS from_name TEXT,
  ADD COLUMN IF NOT EXISTS from_email TEXT,
  ADD COLUMN IF NOT EXISTS html_content TEXT,
  ADD COLUMN IF NOT EXISTS text_content TEXT;

-- Add email tracking fields to broadcast_recipients
ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

-- Add index for efficient lookup by channel
CREATE INDEX IF NOT EXISTS idx_broadcasts_channel
  ON broadcasts(channel);

-- Add index for email tracking
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_opened
  ON broadcast_recipients(opened_at)
  WHERE opened_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_clicked
  ON broadcast_recipients(clicked_at)
  WHERE clicked_at IS NOT NULL;
