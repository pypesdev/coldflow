import { google } from 'googleapis';
import {
  getEmailAccountById,
  updateEmailAccountTokens,
  updateEmailAccountStatus,
  incrementEmailAccountQuota,
} from '@coldflow/db';
import { decryptToken, encryptToken } from './tokenEncryption';
import { refreshAccessToken, getOAuth2Client } from './googleOAuth';
import { buildMimeMessage, toGmailRawString } from './mime';
import { injectTracking } from './emailTracking';

/**
 * Gmail API Service
 *
 * Handles sending emails via Gmail API with automatic token refresh
 * and tracking pixel/link injection.
 */

interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  bodyHtml?: string;
  bodyText: string;
  trackingId: string;
  fromName?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Construct a base64url-encoded RFC 2822 message ready for Gmail's
 * `users.messages.send`. Tracking pixel + click rewrite happen in
 * `emailTracking.ts`; header/body encoding happens in `mime.ts`.
 */
function createMimeMessage(options: SendEmailOptions, fromEmail: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';

  const htmlBody = options.bodyHtml
    ? injectTracking(options.bodyHtml, {
        baseUrl,
        trackingId: options.trackingId,
      })
    : null;

  const message = buildMimeMessage({
    fromEmail,
    fromName: options.fromName ?? null,
    toEmail: options.to,
    toName: options.toName ?? null,
    subject: options.subject,
    bodyText: options.bodyText,
    bodyHtml: htmlBody,
  });

  return toGmailRawString(message);
}

/**
 * Send an email via Gmail API
 *
 * @param emailAccountId - The email account to send from
 * @param options - Email content and recipient info
 * @returns Result with success status and message ID
 */
export async function sendEmail(
  emailAccountId: string,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  try {
    // Fetch email account from database
    const account = await getEmailAccountById(emailAccountId);

    if (!account) {
      return {
        success: false,
        error: 'Email account not found',
      };
    }

    if (account.status !== 'connected') {
      return {
        success: false,
        error: `Email account is ${account.status}. Please reconnect.`,
      };
    }

    if (!account.encryptedAccessToken || !account.encryptedRefreshToken) {
      return {
        success: false,
        error: 'No OAuth tokens found. Please reconnect the account.',
      };
    }

    // Check if token is expired or expiring soon (within 5 minutes)
    const now = new Date();
    const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : new Date(0);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    let accessToken: string;

    if (expiresAt < fiveMinutesFromNow) {
      // Token expired or expiring soon - refresh it
      try {
        const refreshToken = decryptToken(account.encryptedRefreshToken);
        const newTokens = await refreshAccessToken(refreshToken);

        // Encrypt and store new access token
        const encryptedAccessToken = encryptToken(newTokens.accessToken);
        await updateEmailAccountTokens(
          emailAccountId,
          encryptedAccessToken,
          account.encryptedRefreshToken,
          new Date(newTokens.expiryDate)
        );

        accessToken = newTokens.accessToken;
      } catch (error) {
        // Token refresh failed - mark account as error
        await updateEmailAccountStatus(
          emailAccountId,
          'error',
          `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        return {
          success: false,
          error: 'Failed to refresh access token. Please reconnect the account.',
        };
      }
    } else {
      // Token is still valid - decrypt and use it
      accessToken = decryptToken(account.encryptedAccessToken);
    }

    // Create OAuth2 client with access token
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create MIME message
    const raw = createMimeMessage(options, account.email);

    // Send email via Gmail API
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
      },
    });

    if (!response.data.id) {
      return {
        success: false,
        error: 'No message ID returned from Gmail API',
      };
    }

    // Update quota usage
    await incrementEmailAccountQuota(emailAccountId);

    return {
      success: true,
      messageId: response.data.id,
    };
  } catch (error) {
    console.error('Gmail send error:', error);

    // Check for quota exceeded error
    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('limit')) {
        return {
          success: false,
          error: 'Daily sending quota exceeded. Please try again tomorrow.',
        };
      }

      if (error.message.includes('authentication') || error.message.includes('invalid_grant')) {
        return {
          success: false,
          error: 'Authentication failed. Please reconnect the account.',
        };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending email',
    };
  }
}

/**
 * Check if an email account has available quota
 */
export async function hasAvailableQuota(emailAccountId: string): Promise<boolean> {
  const account = await getEmailAccountById(emailAccountId);

  if (!account) return false;

  // Check if quota needs to be reset (new day)
  const now = new Date();
  const resetAt = account.quotaResetAt ? new Date(account.quotaResetAt) : null;

  if (resetAt && now >= resetAt) {
    // Quota should be reset - this will be handled by a background job
    // For now, assume quota is available
    return true;
  }

  return account.quotaUsedToday < account.dailyQuota;
}
