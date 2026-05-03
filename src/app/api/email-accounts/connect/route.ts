import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthorizationError } from '@/lib/authorization';
import { getGmailAuthorizationUrl } from '@/lib/googleOAuth';
import { encodeOAuthState } from '@/lib/oauthState';

/**
 * POST /api/email-accounts/connect
 *
 * Initiate a connection flow for an email provider.
 *
 * For Gmail, this returns an OAuth authorization URL containing a signed
 * state parameter. The client redirects the user to that URL; Google
 * redirects back to /api/email-accounts/oauth/callback with an
 * authorization code, which is exchanged for refresh + access tokens.
 *
 * Outlook and IMAP are not yet implemented and return 501 so the UI can
 * surface a clear error message instead of silently failing.
 */

interface ConnectBody {
  provider?: string;
  subAgencyId?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    let body: ConnectBody = {};
    try {
      body = (await request.json()) as ConnectBody;
    } catch {
      // Treat empty / non-JSON body as missing provider, handled below.
    }

    const provider = body.provider;
    const subAgencyId =
      typeof body.subAgencyId === 'string' && body.subAgencyId.length > 0
        ? body.subAgencyId
        : null;

    if (provider === 'gmail') {
      const state = encodeOAuthState({ userId: user.id, subAgencyId });
      const authUrl = getGmailAuthorizationUrl(state);

      return NextResponse.json({ success: true, authUrl });
    }

    if (provider === 'outlook') {
      return NextResponse.json(
        {
          success: false,
          error: 'Outlook connection is not yet supported',
        },
        { status: 501 }
      );
    }

    if (provider === 'imap') {
      return NextResponse.json(
        {
          success: false,
          error: 'IMAP connection is not yet supported',
        },
        { status: 501 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unknown or missing provider',
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error initiating email account connection:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start email account connection',
      },
      { status: 500 }
    );
  }
}
