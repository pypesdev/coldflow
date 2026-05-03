/**
 * OAuth state parameter helpers.
 *
 * The state parameter prevents CSRF attacks by binding the OAuth callback to
 * the user/session that initiated it. We embed the userId, optional
 * subAgencyId, and a timestamp so the callback can verify freshness.
 */

export interface OAuthStateData {
  userId: string;
  subAgencyId: string | null;
  timestamp: number;
}

const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;

export function encodeOAuthState(data: Omit<OAuthStateData, 'timestamp'> & { timestamp?: number }): string {
  const payload: OAuthStateData = {
    userId: data.userId,
    subAgencyId: data.subAgencyId,
    timestamp: data.timestamp ?? Date.now(),
  };

  if (!payload.userId) {
    throw new Error('userId is required to encode OAuth state');
  }

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decodeOAuthState(state: string, maxAgeMs: number = DEFAULT_MAX_AGE_MS): OAuthStateData {
  if (!state) {
    throw new Error('State parameter is missing');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
  } catch {
    throw new Error('State parameter is malformed');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as OAuthStateData).userId !== 'string' ||
    typeof (parsed as OAuthStateData).timestamp !== 'number'
  ) {
    throw new Error('State parameter has unexpected shape');
  }

  const data = parsed as OAuthStateData;

  // Normalize subAgencyId: accept null or string, coerce missing to null
  const subAgencyId =
    typeof data.subAgencyId === 'string' && data.subAgencyId.length > 0
      ? data.subAgencyId
      : null;

  const age = Date.now() - data.timestamp;
  if (age < 0 || age > maxAgeMs) {
    throw new Error('State parameter expired');
  }

  return {
    userId: data.userId,
    subAgencyId,
    timestamp: data.timestamp,
  };
}
