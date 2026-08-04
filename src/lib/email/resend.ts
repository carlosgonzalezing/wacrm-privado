import { Resend } from 'resend';
import type { EmailSendResult, EmailRecipient, EmailBroadcastData } from './types';

/**
 * Send email using Resend API
 */
export async function sendResendEmail(
  apiKey: string,
  data: EmailBroadcastData,
  recipient: EmailRecipient,
): Promise<EmailSendResult> {
  try {
    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from: `${data.from_name} <${data.from_email}>`,
      to: [recipient.to_email],
      subject: data.subject,
      html: data.html_content,
      text: data.text_content,
      replyTo: data.from_email,
    });

    return {
      success: true,
      message_id: result.data?.id,
    };
  } catch (error) {
    console.error('Resend error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send batch emails using Resend API
 */
export async function sendBatchResendEmails(
  apiKey: string,
  data: EmailBroadcastData,
  recipients: EmailRecipient[],
): Promise<EmailSendResult[]> {
  try {
    const resend = new Resend(apiKey);

    // Resend doesn't have a true batch API, so we send sequentially
    // For high volume, you'd want to use a queue system
    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        resend.emails.send({
          from: `${data.from_name} <${data.from_email}>`,
          to: [recipient.to_email],
          subject: data.subject,
          html: data.html_content,
          text: data.text_content,
          replyTo: data.from_email,
        })
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          success: true,
          message_id: result.value.data?.id,
        };
      } else {
        return {
          success: false,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        };
      }
    });
  } catch (error) {
    console.error('Resend batch error:', error);
    return recipients.map(() => ({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}
