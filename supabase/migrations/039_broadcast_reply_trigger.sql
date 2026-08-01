-- ============================================================
-- Add `broadcast_reply` trigger type for flows.
--
-- This new trigger allows a flow to start when a contact replies to
-- a recent broadcast/campaign — instead of only on keyword or
-- first-inbound. Combined with the broadcast_id tracking already
-- present in flow_runs (migration 038), this enables per-campaign
-- flow restarts: a contact who already completed a flow for
-- Campaign A gets a fresh run for Campaign B.
--
-- The trigger_config JSONB carries an optional `ttl_hours` (default
-- 72) that defines how long after the broadcast send the flow
-- remains eligible to start.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- Drop the existing CHECK constraint on trigger_type so we can
-- re-add it with the new value included.
ALTER TABLE flows
  DROP CONSTRAINT IF EXISTS flows_trigger_type_check;

ALTER TABLE flows
  ADD CONSTRAINT flows_trigger_type_check
  CHECK (trigger_type IN (
    'keyword',
    'first_inbound_message',
    'manual',
    'broadcast_reply'
  ));

-- The partial index `idx_flows_account_active` (migration 020) already
-- covers account-scoped active-flow lookups regardless of trigger_type,
-- so `broadcast_reply` flows are captured without a new index.
-- `idx_flows_active_trigger` (migration 010) is user_id-scoped and
-- trigger_type-generic in its WHERE; it also covers the new type.