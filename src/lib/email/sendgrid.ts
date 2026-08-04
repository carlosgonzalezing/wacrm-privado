import sgMail from '@sendgrid/mail';
import type { EmailSendResult, EmailRecipient, EmailBroadcastData } from './types';

/**
 * Send email using SendGrid API
 */
export async function sendSendGridEmail(
  apiKey: string,
  data: EmailBroadcastData,
  recipient: EmailRecipient,
): Promise<EmailSendResult> {
  try {
    sgMail.setApiKey(apiKey);

    const msg = {
      to: recipient.to_email,
      from: {
        name: data.from_name,
        email: data.from_email,
      },
      subject: data.subject,
      text: data.text_content,
      html: data.html_content,
      customArgs: recipient.variables,
    };

    const response = await sgMail.send(msg);

    return {
      success: true,
      message_id: response[0]?.headers?.['x-message-id'],
    };
  } catch (error) {
    console.error('SendGrid error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send batch emails using SendGrid API
 */
export async function sendBatchSendGridEmails(
  apiKey: string,
  data: EmailBroadcastData,
  recipients: EmailRecipient[],
): Promise<EmailSendResult[]> {
  try {
    sgMail.setApiKey(apiKey);

    const messages = recipients.map((recipient) => ({
      to: recipient.to_email,
      from: {
        name: data.from_name,
        email: data.from_email,
      },
      subject: data.subject,
      text: data.text_content,
      html: data.html_content,
      customArgs: recipient.variables,
    }));

    const response = await sgMail.send(messages);

    return response.map((res) => ({
      success: true,
      message_id: res.headers?.['x-message-id'],
    }));
  } catch (error) {
    console.error('SendGrid batch error:', error);
    return recipients.map(() => ({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}
