import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import {
  exchangeCodeForTokens,
  getUserInfo,
} from '@/lib/googleOAuth';
import { encryptToken } from '@/lib/tokenEncryption';
import { decodeOAuthState, type OAuthStateData } from '@/lib/oauthState';
import {
  createEmailAccount,
  emailAccountExists,
} from '@coldflow/db';

/**
 * GET /api/email-accounts/oauth/callback
 *
 * OAuth callback endpoint for Gmail account connection.
 * This is called by Google after the user authorizes the application.
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors (user denied access, etc.)
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/email-accounts?error=${encodeURIComponent(error)}`,
          request.url
        )
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/email-accounts?error=missing_parameters',
          request.url
        )
      );
    }

    // Decode and verify state parameter (CSRF + freshness)
    let stateData: OAuthStateData;
    try {
      stateData = decodeOAuthState(state);
    } catch (_error) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/email-accounts?error=invalid_state',
          request.url
        )
      );
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get user info to retrieve email address
    const userInfo = await getUserInfo(tokens.accessToken);

    // Check if this email account is already connected
    const exists = await emailAccountExists(stateData.userId, userInfo.email);
    if (exists) {
      return NextResponse.redirect(
        new URL(
          '/dashboard/email-accounts?error=account_already_connected',
          request.url
        )
      );
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const encryptedRefreshToken = encryptToken(tokens.refreshToken);

    // Calculate token expiry date
    const tokenExpiresAt = new Date(tokens.expiryDate);

    // Calculate next quota reset (midnight UTC)
    const quotaResetAt = new Date();
    quotaResetAt.setUTCHours(24, 0, 0, 0);

    // Create email account record
    await createEmailAccount({
      id: nanoid(),
      userId: stateData.userId,
      subAgencyId: stateData.subAgencyId,
      email: userInfo.email,
      provider: 'gmail',
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenExpiresAt,
      scopes: tokens.scope,
      status: 'connected',
      dailyQuota: 500, // Standard Gmail quota (user can update if they have Workspace)
      quotaUsedToday: 0,
      quotaResetAt,
      lastSyncedAt: new Date(),
    });

    // Redirect to success page
    return NextResponse.redirect(
      new URL(
        `/dashboard/email-accounts?success=account_connected&email=${encodeURIComponent(userInfo.email)}`,
        request.url
      )
    );
  } catch (error) {
    console.error('OAuth callback error:', error);

    return NextResponse.redirect(
      new URL(
        `/dashboard/email-accounts?error=${encodeURIComponent(
          error instanceof Error ? error.message : 'connection_failed'
        )}`,
        request.url
      )
    );
  }
}
