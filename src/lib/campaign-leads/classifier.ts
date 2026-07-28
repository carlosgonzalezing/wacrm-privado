// ============================================================
// Campaign Lead AI Classifier
//
// Analyzes conversation context to classify lead interest level
// and generate AI summaries for campaign leads.
// ============================================================

import { createClient } from '@supabase/supabase-js'

export interface LeadClassification {
  classification: 'interested' | 'not_interested' | 'needs_info' | 'requesting_call' | 'pending_ai'
  interest_level: 'low' | 'medium' | 'high' | 'very_high' | null
  summary: string
  confidence: number
}

export interface ClassificationContext {
  conversation_id: string
  contact_id: string
  broadcast_id: string
  account_id: string
  message_text: string
  conversation_history: Array<{ role: string; content: string }>
}

export interface CampaignLeadData {
  account_id: string
  broadcast_id: string
  contact_id: string
  conversation_id: string
  classification: string
  interest_level: string | null
  ai_summary: string
  metadata: any
  first_response_at: string
  last_activity_at: string
  status?: string
}

/**
 * Classify a lead based on conversation context using AI
 */
export async function classifyLead(
  context: ClassificationContext,
  aiConfig: { provider: string; model: string; api_key: string; system_prompt?: string }
): Promise<LeadClassification> {
  const { provider, model, api_key, system_prompt } = aiConfig

  // Build the classification prompt
  const prompt = buildClassificationPrompt(context, system_prompt)

  try {
    let classification: LeadClassification

    if (provider === 'openai') {
      classification = await classifyWithOpenAI(model, api_key, prompt)
    } else if (provider === 'anthropic') {
      classification = await classifyWithAnthropic(model, api_key, prompt)
    } else if (provider === 'groq') {
      classification = await classifyWithGroq(model, api_key, prompt)
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`)
    }

    return classification
  } catch (error) {
    console.error('[campaign-leads] AI classification failed:', error)
    // Return default pending classification on failure
    return {
      classification: 'pending_ai',
      interest_level: null,
      summary: 'AI classification pending',
      confidence: 0
    }
  }
}

function buildClassificationPrompt(
  context: ClassificationContext,
  systemPrompt?: string
): string {
  const { message_text, conversation_history } = context

  const historyText = conversation_history
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n')

  return `${systemPrompt || 'You are a lead qualification assistant for a sales team.'}

Analyze the following conversation and classify the lead's interest level.

Latest message: ${message_text}

Conversation history:
${historyText || 'No previous messages'}

Respond in JSON format with:
{
  "classification": "interested" | "not_interested" | "needs_info" | "requesting_call",
  "interest_level": "low" | "medium" | "high" | "very_high",
  "summary": "Brief summary of the conversation and customer's intent",
  "confidence": 0.0-1.0
}

Classification guidelines:
- "interested": Customer shows genuine interest in the product/service
- "not_interested": Customer explicitly declines or shows no interest
- "needs_info": Customer asks questions about the product/service
- "requesting_call": Customer explicitly asks for a phone call or meeting
`
}

async function classifyWithOpenAI(
  model: string,
  apiKey: string,
  prompt: string
): Promise<LeadClassification> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  const content = JSON.parse(data.choices[0].message.content)

  return {
    classification: content.classification,
    interest_level: content.interest_level,
    summary: content.summary,
    confidence: content.confidence
  }
}

async function classifyWithAnthropic(
  model: string,
  apiKey: string,
  prompt: string
): Promise<LeadClassification> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      system: 'Respond only with valid JSON.',
      temperature: 0.3
    })
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`)
  }

  const data = await response.json()
  const content = JSON.parse(data.content[0].text)

  return {
    classification: content.classification,
    interest_level: content.interest_level,
    summary: content.summary,
    confidence: content.confidence
  }
}

/**
 * Groq API - FREE option for development
 * Uses OpenAI-compatible API with Llama 3 / Mixtral models
 */
async function classifyWithGroq(
  model: string,
  apiKey: string,
  prompt: string
): Promise<LeadClassification> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'llama3-70b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.statusText}`)
  }

  const data = await response.json()
  const content = JSON.parse(data.choices[0].message.content)

  return {
    classification: content.classification,
    interest_level: content.interest_level,
    summary: content.summary,
    confidence: content.confidence
  }
}

/**
 * Create or update a campaign lead based on classification
 */
// @ts-ignore - Supabase type inference issues with dynamic table operations
export async function upsertCampaignLead(
  supabase: ReturnType<typeof createClient>,
  data: {
    account_id: string
    broadcast_id: string
    contact_id: string
    conversation_id: string
    classification: LeadClassification
  }
) {
  const { account_id, broadcast_id, contact_id, conversation_id, classification } = data

  // Check if lead already exists for this contact/broadcast combination
  const { data: existingLead } = await supabase
    .from('campaign_leads')
    .select('*')
    .eq('contact_id', contact_id)
    .eq('broadcast_id', broadcast_id)
    .maybeSingle() as { data: any | null }

  const leadData: any = {
    account_id,
    broadcast_id,
    contact_id,
    conversation_id,
    classification: classification.classification,
    interest_level: classification.interest_level,
    ai_summary: classification.summary,
    metadata: {
      confidence: classification.confidence,
      classified_at: new Date().toISOString()
    },
    first_response_at: existingLead?.first_response_at || new Date().toISOString(),
    last_activity_at: new Date().toISOString()
  }

  if (existingLead) {
    // Update existing lead
    const { error } = await supabase
      .from('campaign_leads')
      // @ts-ignore
      .update(leadData)
      .eq('id', existingLead.id)

    if (error) throw error
    return { created: false, lead: existingLead }
  } else {
    // Create new lead
    const { data: newLead, error } = await supabase
      .from('campaign_leads')
      // @ts-ignore
      .insert({
        ...leadData,
        status: 'new'
      })
      .select()
      .single()

    if (error) throw error
    return { created: true, lead: newLead }
  }
}
