// ============================================================
// Email provider types and configuration
// ============================================================

export type EmailProvider = 'sendgrid' | 'mailgun' | 'ses' | 'resend';

export type BroadcastChannel = 'whatsapp' | 'email';

export interface EmailConfig {
  id: string;
  account_id: string;
  provider: EmailProvider;
  from_name: string;
  from_email: string;
  reply_to_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailBroadcastData {
  subject: string;
  from_name: string;
  from_email: string;
  html_content: string;
  text_content: string;
}

export interface EmailRecipient {
  to_email: string;
  to_name?: string;
  variables?: Record<string, string>;
}

export interface EmailSendResult {
  success: boolean;
  message_id?: string;
  error?: string;
}
