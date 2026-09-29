export type CronAuthFailure =
  | { ok: false; status: 500; error: 'Server misconfiguration' }
  | { ok: false; status: 401; error: 'Unauthorized' }

export type CronAuthSuccess = { ok: true }

export type CronAuthResult = CronAuthFailure | CronAuthSuccess

/**
 * Validate the `Authorization: Bearer <CRON_SECRET>` header used by every
 * `/api/cron/*` route. Pure function so route handlers stay thin and the
 * auth contract is unit-testable.
 *
 * Vercel Cron sends GET requests with the project's `CRON_SECRET` injected
 * automatically — the same env var that POST callers use, so a single helper
 * covers both methods.
 */
export function verifyCronAuth(input: {
  authorizationHeader: string | null
  cronSecret: string | undefined
}): CronAuthResult {
  if (!input.cronSecret) {
    return { ok: false, status: 500, error: 'Server misconfiguration' }
  }
  const expected = `Bearer ${input.cronSecret}`
  if (!input.authorizationHeader || input.authorizationHeader !== expected) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  return { ok: true }
}
