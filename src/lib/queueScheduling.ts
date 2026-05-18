/**
 * Pure scheduling helpers for the email queue processor.
 *
 * Kept here (and not in `emailQueueProcessor.ts`) so the decision logic can
 * be unit-tested without the DB / Gmail dependency graph. The processor
 * imports from this module instead of inlining the math.
 */

const ONE_MINUTE_MS = 60 * 1000;

/**
 * Decide when to next try sending a queue entry whose account is over its
 * daily quota.
 *
 * Inputs:
 *   - `quotaResetAt` — the account's stored quota reset timestamp (may be
 *      null if the account record has never been initialized, may be in
 *      the past if a reset hasn't been written back yet).
 *   - `now` — wall-clock time of the current processing pass.
 *   - `minDelayMs` (optional, defaults to 1 minute) — floor on how soon we
 *      will retry. Prevents a tight loop when `quotaResetAt` is the same
 *      tick as `now` or already in the past.
 *
 * Returns a Date strictly in the future relative to `now`. Callers should
 * write that Date back to the queue entry's `scheduledFor` so
 * `getNextPendingEmails` (which filters by `scheduledFor <= now`) skips it
 * until the reset time arrives.
 */
export function computeQuotaRescheduleAt(
  quotaResetAt: Date | null | undefined,
  now: Date = new Date(),
  minDelayMs: number = ONE_MINUTE_MS
): Date {
  const floor = new Date(now.getTime() + Math.max(minDelayMs, 0));

  if (!quotaResetAt) {
    return floor;
  }

  if (quotaResetAt.getTime() > floor.getTime()) {
    return new Date(quotaResetAt.getTime());
  }

  return floor;
}
