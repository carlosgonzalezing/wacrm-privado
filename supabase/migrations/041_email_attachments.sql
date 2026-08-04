-- ============================================================
-- Add email attachments support
--
-- This enables attaching images and videos to email broadcasts.
-- ============================================================

-- Add attachments array column to broadcasts
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- Add index for attachments
CREATE INDEX IF NOT EXISTS idx_broadcasts_attachments
  ON broadcasts USING GIN (attachments);
