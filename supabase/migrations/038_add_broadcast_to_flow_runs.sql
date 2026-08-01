-- ============================================================
-- Add broadcast_id to flow_runs for campaign tracking
--
-- This allows the flow runner to distinguish between different campaigns
-- even when they use the same flow, enabling proper restart behavior
-- when a contact responds to multiple campaigns in a day.
-- ============================================================

-- Add broadcast_id column to flow_runs
ALTER TABLE flow_runs
  ADD COLUMN IF NOT EXISTS broadcast_id UUID REFERENCES broadcasts(id) ON DELETE SET NULL;

-- Add index for efficient lookup of active runs by broadcast
CREATE INDEX IF NOT EXISTS idx_flow_runs_broadcast
  ON flow_runs(broadcast_id)
  WHERE status = 'active';
