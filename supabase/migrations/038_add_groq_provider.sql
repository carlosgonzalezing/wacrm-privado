-- ============================================================
-- 038_add_groq_provider.sql — Add Groq as AI provider
--
-- Adds Groq as a free AI provider option for lead classification
-- and auto-reply. Groq uses OpenAI-compatible API with Llama 3 models.
-- ============================================================

-- Update the CHECK constraint to include 'groq'
ALTER TABLE ai_configs 
  DROP CONSTRAINT IF EXISTS ai_configs_provider_check;

ALTER TABLE ai_configs 
  ADD CONSTRAINT ai_configs_provider_check 
  CHECK (provider IN ('openai', 'anthropic', 'groq'));
