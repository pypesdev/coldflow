import { describe, expect, it } from 'vitest';
import { computeQuotaRescheduleAt } from '@/lib/queueScheduling';

describe('computeQuotaRescheduleAt', () => {
  const now = new Date('2026-05-03T12:00:00Z');

  it('uses quotaResetAt when it is far in the future', () => {
    const reset = new Date('2026-05-04T00:00:00Z');
    expect(computeQuotaRescheduleAt(reset, now).toISOString()).toBe(
      reset.toISOString()
    );
  });

  it('falls back to now+minDelay when quotaResetAt is null', () => {
    const out = computeQuotaRescheduleAt(null, now);
    expect(out.getTime()).toBe(now.getTime() + 60_000);
  });

  it('falls back to now+minDelay when quotaResetAt is undefined', () => {
    const out = computeQuotaRescheduleAt(undefined, now);
    expect(out.getTime()).toBe(now.getTime() + 60_000);
  });

  it('floors at now+minDelay when quotaResetAt is already in the past', () => {
    const past = new Date('2026-05-03T11:00:00Z');
    const out = computeQuotaRescheduleAt(past, now);
    expect(out.getTime()).toBe(now.getTime() + 60_000);
  });

  it('floors at now+minDelay when quotaResetAt equals now', () => {
    const out = computeQuotaRescheduleAt(now, now);
    expect(out.getTime()).toBe(now.getTime() + 60_000);
  });

  it('floors at now+minDelay when quotaResetAt is sooner than the floor', () => {
    const reset = new Date(now.getTime() + 30_000); // 30s ahead of now
    const out = computeQuotaRescheduleAt(reset, now);
    expect(out.getTime()).toBe(now.getTime() + 60_000);
  });

  it('uses quotaResetAt when it is just past the floor', () => {
    const reset = new Date(now.getTime() + 90_000); // 90s ahead
    const out = computeQuotaRescheduleAt(reset, now);
    expect(out.toISOString()).toBe(reset.toISOString());
  });

  it('honors a custom minDelayMs', () => {
    const out = computeQuotaRescheduleAt(null, now, 5 * 60_000);
    expect(out.getTime()).toBe(now.getTime() + 5 * 60_000);
  });

  it('treats negative minDelayMs as zero (never schedules earlier than now)', () => {
    const out = computeQuotaRescheduleAt(null, now, -1000);
    expect(out.getTime()).toBe(now.getTime());
    // Strictly: >= now. The processor still won't pick it again until the
    // next pass, so this is intentional rather than buggy.
    expect(out.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  it('returns a fresh Date instance (not the input)', () => {
    const reset = new Date('2026-05-04T00:00:00Z');
    const out = computeQuotaRescheduleAt(reset, now);
    expect(out).not.toBe(reset);
    expect(out.getTime()).toBe(reset.getTime());
  });

  it('uses the system clock when `now` is omitted', () => {
    const before = Date.now();
    const out = computeQuotaRescheduleAt(null);
    const after = Date.now();
    // Output should be in [before+60_000, after+60_000].
    expect(out.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(out.getTime()).toBeLessThanOrEqual(after + 60_000);
  });

  it('never returns a Date earlier than `now` for any reset value', () => {
    const cases: Array<Date | null | undefined> = [
      null,
      undefined,
      new Date('1970-01-01T00:00:00Z'),
      new Date('2026-05-03T11:59:59Z'),
      new Date('2026-05-03T12:00:00Z'),
      new Date('2026-05-03T12:00:01Z'),
      new Date('2099-01-01T00:00:00Z'),
    ];
    for (const reset of cases) {
      const out = computeQuotaRescheduleAt(reset, now);
      expect(out.getTime()).toBeGreaterThanOrEqual(now.getTime());
    }
  });
});
