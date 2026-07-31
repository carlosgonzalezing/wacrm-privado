-- ============================================================
-- 037_campaign_leads.sql — Campaign lead tracking system
--
-- Adds campaign_leads table to track leads generated from broadcast
-- campaigns, separate from the master contacts table. This allows:
-- - One contact to generate multiple leads across different campaigns
-- - AI classification of lead interest level
-- - AI-generated summaries of conversations
-- - Assignment to advisors/agents
-- - Export to external systems without CRM access
--
-- Design notes:
--   - campaign_leads is the core table for campaign-generated leads
--   - Each lead is tied to a specific broadcast and contact
--   - AI classification: interested, not_interested, needs_info, pending_ai
--   - Interest level: low, medium, high, very_high
--   - ai_summary contains the AI-generated conversation summary
--   - advisor_id references the assigned team member
--   - status tracks the lead lifecycle: new, assigned, contacted, qualified, lost, converted
--
-- RLS:
--   - Any account member can view leads
--   - Admin+ can create/update/delete leads
--   - Service role can insert leads (webhook/AI classification)
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- CAMPAIGN_LEADS table
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  
  -- AI Classification
  classification TEXT NOT NULL DEFAULT 'pending_ai' 
    CHECK (classification IN ('pending_ai', 'interested', 'not_interested', 'needs_info', 'requesting_call')),
  interest_level TEXT 
    CHECK (interest_level IN ('low', 'medium', 'high', 'very_high')),
  ai_summary TEXT,
  
  -- Lead Management
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'assigned', 'contacted', 'qualified', 'lost', 'converted')),
  advisor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  
  -- Metadata
  first_response_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_leads_account ON campaign_leads(account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_broadcast ON campaign_leads(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_contact ON campaign_leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_classification ON campaign_leads(classification);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON campaign_leads(status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_advisor ON campaign_leads(advisor_id);

-- Unique constraint: one lead per contact per broadcast
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_leads_unique_contact_broadcast 
  ON campaign_leads(contact_id, broadcast_id);

ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;

-- SELECT: any account member can view leads
DROP POLICY IF EXISTS campaign_leads_select ON campaign_leads;
CREATE POLICY campaign_leads_select ON campaign_leads FOR SELECT
  USING (is_account_member(account_id));

-- INSERT: service role (webhook/AI) or admin+
DROP POLICY IF EXISTS campaign_leads_insert ON campaign_leads;
CREATE POLICY campaign_leads_insert ON campaign_leads FOR INSERT
  WITH CHECK (
    is_account_member(account_id, 'admin') OR 
    (auth.uid() IS NULL) -- service role
  );

-- UPDATE: admin+ only
DROP POLICY IF EXISTS campaign_leads_update ON campaign_leads;
CREATE POLICY campaign_leads_update ON campaign_leads FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

-- DELETE: admin+ only
DROP POLICY IF EXISTS campaign_leads_delete ON campaign_leads;
CREATE POLICY campaign_leads_delete ON campaign_leads FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- ============================================================
-- Update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_campaign_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaign_leads_updated_at ON campaign_leads;
CREATE TRIGGER campaign_leads_updated_at
  BEFORE UPDATE ON campaign_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaign_leads_updated_at();

-- ============================================================
-- Extend broadcasts table with lead metrics
-- ============================================================
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS leads_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS not_interested_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS needs_info_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requesting_call_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_ai_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualified_leads_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS converted_leads_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- Function to recompute broadcast lead counts
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_broadcast_lead_counts(bid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE broadcasts b SET
    leads_count = agg.total_leads,
    not_interested_count = agg.not_interested,
    needs_info_count = agg.needs_info,
    requesting_call_count = agg.requesting_call,
    pending_ai_count = agg.pending_ai,
    qualified_leads_count = agg.qualified,
    converted_leads_count = agg.converted,
    updated_at = NOW()
  FROM (
    SELECT
      COUNT(*) AS total_leads,
      COUNT(*) FILTER (WHERE classification = 'not_interested') AS not_interested,
      COUNT(*) FILTER (WHERE classification = 'needs_info') AS needs_info,
      COUNT(*) FILTER (WHERE classification = 'requesting_call') AS requesting_call,
      COUNT(*) FILTER (WHERE classification = 'pending_ai') AS pending_ai,
      COUNT(*) FILTER (WHERE status = 'qualified') AS qualified,
      COUNT(*) FILTER (WHERE status = 'converted') AS converted
    FROM campaign_leads
    WHERE broadcast_id = bid
  ) agg
  WHERE b.id = bid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- Trigger to auto-update broadcast lead counts
-- ============================================================
CREATE OR REPLACE FUNCTION public.campaign_lead_aggregate_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_broadcast_lead_counts(OLD.broadcast_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' OR 
     OLD.classification IS DISTINCT FROM NEW.classification OR
     OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.recompute_broadcast_lead_counts(NEW.broadcast_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS campaign_leads_aggregate ON campaign_leads;
CREATE TRIGGER campaign_leads_aggregate
AFTER INSERT OR UPDATE OR DELETE ON campaign_leads
FOR EACH ROW
EXECUTE FUNCTION public.campaign_lead_aggregate_trigger();

-- ============================================================
-- Grant execute permissions for service role
-- ============================================================
GRANT EXECUTE ON FUNCTION public.recompute_broadcast_lead_counts(uuid) TO service_role;
