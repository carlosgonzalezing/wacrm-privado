import { sendSendGridEmail, sendBatchSendGridEmails } from './sendgrid';
import type { EmailProvider, EmailSendResult, EmailBroadcastData, EmailRecipient } from './types';

export interface SendEmailArgs {
  provider: EmailProvider;
  apiKey: string;
  data: EmailBroadcastData;
  recipient: EmailRecipient;
}

export interface SendBatchEmailsArgs {
  provider: EmailProvider;
  apiKey: string;
  data: EmailBroadcastData;
  recipients: EmailRecipient[];
}

/**
 * Unified email sending function - dispatches to the right provider
 */
export async function sendEmail(args: SendEmailArgs): Promise<EmailSendResult> {
  const { provider, apiKey, data, recipient } = args;

  switch (provider) {
    case 'sendgrid':
      return sendSendGridEmail(apiKey, data, recipient);
    case 'mailgun':
      // TODO: Implement Mailgun
      return { success: false, error: 'Mailgun not implemented yet' };
    case 'ses':
      // TODO: Implement AWS SES
      return { success: false, error: 'AWS SES not implemented yet' };
    case 'resend':
      // TODO: Implement Resend
      return { success: false, error: 'Resend not implemented yet' };
    default:
      return { success: false, error: `Unknown provider: ${provider}` };
  }
}

/**
 * Unified batch email sending function
 */
export async function sendBatchEmails(args: SendBatchEmailsArgs): Promise<EmailSendResult[]> {
  const { provider, apiKey, data, recipients } = args;

  switch (provider) {
    case 'sendgrid':
      return sendBatchSendGridEmails(apiKey, data, recipients);
    case 'mailgun':
      // TODO: Implement Mailgun
      return recipients.map(() => ({ success: false, error: 'Mailgun not implemented yet' }));
    case 'ses':
      // TODO: Implement AWS SES
      return recipients.map(() => ({ success: false, error: 'AWS SES not implemented yet' }));
    case 'resend':
      // TODO: Implement Resend
      return recipients.map(() => ({ success: false, error: 'Resend not implemented yet' }));
    default:
      return recipients.map(() => ({ success: false, error: `Unknown provider: ${provider}` }));
  }
}

export type { EmailProvider, EmailSendResult, EmailBroadcastData, EmailRecipient } from './types';
