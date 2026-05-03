import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { AuthorizationError } from '@/lib/authorization';
import { decodeOAuthState } from '@/lib/oauthState';

// --- Mock collaborators -----------------------------------------------------
//
// The connect route depends on:
//   - requireAuth() from '@/lib/authorization' (DB + better-auth)
//   - getGmailAuthorizationUrl() from '@/lib/googleOAuth' (env vars)
//
// We mock both so the test runs without a database, OAuth client, or env.

vi.mock('@/lib/authorization', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/authorization')>(
      '@/lib/authorization'
    );
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

vi.mock('@/lib/googleOAuth', () => ({
  getGmailAuthorizationUrl: vi.fn(
    (state: string) =>
      `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`
  ),
}));

// Re-import after mocks are registered
import { requireAuth } from '@/lib/authorization';
import { getGmailAuthorizationUrl } from '@/lib/googleOAuth';
import { POST } from '@/app/api/email-accounts/connect/route';

const mockedRequireAuth = vi.mocked(requireAuth);
const mockedGetGmailAuthorizationUrl = vi.mocked(getGmailAuthorizationUrl);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/email-accounts/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('POST /api/email-accounts/connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAuth.mockResolvedValue({
      id: 'user_abc',
      email: 'jared@example.com',
      name: 'Jared',
    });
  });

  it('returns a Google authorization URL for provider=gmail', async () => {
    const response = await POST(makeRequest({ provider: 'gmail' }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.authUrl).toMatch(/^https:\/\/accounts\.google\.com\//);
    expect(mockedGetGmailAuthorizationUrl).toHaveBeenCalledOnce();
  });

  it('encodes a state parameter that contains the authenticated userId', async () => {
    const response = await POST(makeRequest({ provider: 'gmail' }));
    const json = await response.json();

    const url = new URL(json.authUrl);
    const state = url.searchParams.get('state');
    expect(state).toBeTruthy();

    const decoded = decodeOAuthState(state!);
    expect(decoded.userId).toBe('user_abc');
    expect(decoded.subAgencyId).toBeNull();
  });

  it('embeds the requested subAgencyId in the state when provided', async () => {
    const response = await POST(
      makeRequest({ provider: 'gmail', subAgencyId: 'agency_42' })
    );
    const json = await response.json();

    const url = new URL(json.authUrl);
    const state = url.searchParams.get('state');
    const decoded = decodeOAuthState(state!);

    expect(decoded.subAgencyId).toBe('agency_42');
  });

  it('returns 501 for provider=outlook (not yet implemented)', async () => {
    const response = await POST(makeRequest({ provider: 'outlook' }));
    const json = await response.json();

    expect(response.status).toBe(501);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/outlook/i);
    expect(mockedGetGmailAuthorizationUrl).not.toHaveBeenCalled();
  });

  it('returns 501 for provider=imap (not yet implemented)', async () => {
    const response = await POST(makeRequest({ provider: 'imap' }));
    const json = await response.json();

    expect(response.status).toBe(501);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/imap/i);
  });

  it('returns 400 when provider is missing or unknown', async () => {
    const response = await POST(makeRequest({ provider: 'aol' }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/provider/i);
  });

  it('returns 400 when the body is empty', async () => {
    const response = await POST(makeRequest(undefined));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('returns 401 when the user is not authenticated', async () => {
    mockedRequireAuth.mockRejectedValueOnce(
      new AuthorizationError('Unauthorized', 401)
    );

    const response = await POST(makeRequest({ provider: 'gmail' }));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 500 when the OAuth helper throws (e.g. missing env)', async () => {
    mockedGetGmailAuthorizationUrl.mockImplementationOnce(() => {
      throw new Error('GOOGLE_CLIENT_SECRET is not configured');
    });

    const response = await POST(makeRequest({ provider: 'gmail' }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/GOOGLE_CLIENT_SECRET/);
  });

  it('does not leak tokens or call the OAuth helper before auth succeeds', async () => {
    mockedRequireAuth.mockRejectedValueOnce(
      new AuthorizationError('Unauthorized', 401)
    );

    await POST(makeRequest({ provider: 'gmail' }));

    expect(mockedGetGmailAuthorizationUrl).not.toHaveBeenCalled();
  });
});
