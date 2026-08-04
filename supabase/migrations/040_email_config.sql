-- ============================================================
-- Email provider configuration table
--
-- Stores SendGrid API keys and email settings per account.
-- Similar to whatsapp_configs table structure.
-- ============================================================

CREATE TABLE IF NOT EXISTS email_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'sendgrid' CHECK (provider IN ('sendgrid', 'mailgun', 'ses', 'resend')),
  api_key_encrypted TEXT NOT NULL,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_email_configs_account ON email_configs(account_id);

ALTER TABLE email_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own email config" ON email_configs;
DROP POLICY IF EXISTS "Users can update own email config" ON email_configs;
DROP POLICY IF EXISTS "Users can insert own email config" ON email_configs;

CREATE POLICY "Users can view own email config" ON email_configs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.account_id = email_configs.account_id
    AND profiles.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own email config" ON email_configs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.account_id = email_configs.account_id
    AND profiles.user_id = auth.uid()
    AND profiles.account_role IN ('owner', 'admin')
  ));

CREATE POLICY "Users can insert own email config" ON email_configs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.account_id = email_configs.account_id
    AND profiles.user_id = auth.uid()
    AND profiles.account_role IN ('owner', 'admin')
  ));
