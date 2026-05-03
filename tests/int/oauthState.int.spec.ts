import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encodeOAuthState, decodeOAuthState } from '@/lib/oauthState';

describe('oauthState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('encodeOAuthState', () => {
    it('round-trips userId and subAgencyId', () => {
      const state = encodeOAuthState({
        userId: 'user_abc',
        subAgencyId: 'agency_xyz',
      });

      const decoded = decodeOAuthState(state);

      expect(decoded.userId).toBe('user_abc');
      expect(decoded.subAgencyId).toBe('agency_xyz');
      expect(decoded.timestamp).toBe(Date.now());
    });

    it('round-trips with null subAgencyId', () => {
      const state = encodeOAuthState({
        userId: 'user_abc',
        subAgencyId: null,
      });

      const decoded = decodeOAuthState(state);

      expect(decoded.subAgencyId).toBeNull();
    });

    it('produces a base64 string that is opaque to base64-naive parsers', () => {
      const state = encodeOAuthState({
        userId: 'user_abc',
        subAgencyId: null,
      });

      // base64 alphabet only
      expect(state).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('throws when userId is empty', () => {
      expect(() =>
        encodeOAuthState({ userId: '', subAgencyId: null })
      ).toThrow(/userId is required/);
    });

    it('honours an explicit timestamp override', () => {
      const fixedTimestamp = Date.UTC(2026, 0, 1, 0, 0, 0);
      const state = encodeOAuthState({
        userId: 'user_abc',
        subAgencyId: null,
        timestamp: fixedTimestamp,
      });

      // Move the clock 1 minute past the override timestamp so decode succeeds
      vi.setSystemTime(new Date(fixedTimestamp + 60_000));

      const decoded = decodeOAuthState(state);
      expect(decoded.timestamp).toBe(fixedTimestamp);
    });
  });

  describe('decodeOAuthState', () => {
    it('rejects an empty state', () => {
      expect(() => decodeOAuthState('')).toThrow(/missing/i);
    });

    it('rejects malformed base64 / JSON', () => {
      expect(() => decodeOAuthState('not-valid-json!!!')).toThrow();
    });

    it('rejects a valid base64 string with the wrong shape', () => {
      const bogus = Buffer.from(JSON.stringify({ hello: 'world' })).toString(
        'base64'
      );
      expect(() => decodeOAuthState(bogus)).toThrow(/unexpected shape/i);
    });

    it('rejects a state older than the max age', () => {
      const oldTimestamp = Date.now() - 11 * 60 * 1000; // 11 minutes ago
      const state = encodeOAuthState({
        userId: 'user_abc',
        subAgencyId: null,
        timestamp: oldTimestamp,
      });

      expect(() => decodeOAuthState(state)).toThrow(/expired/i);
    });

    it('rejects a state from the future (clock skew abuse)', () => {
      const futureTimestamp = Date.now() + 60 * 1000;
      const state = encodeOAuthState({
        userId: 'user_abc',
        subAgencyId: null,
        timestamp: futureTimestamp,
      });

      expect(() => decodeOAuthState(state)).toThrow(/expired/i);
    });

    it('coerces missing/empty subAgencyId to null', () => {
      const payload = {
        userId: 'user_abc',
        // subAgencyId omitted entirely
        timestamp: Date.now(),
      };
      const state = Buffer.from(JSON.stringify(payload)).toString('base64');

      const decoded = decodeOAuthState(state);
      expect(decoded.subAgencyId).toBeNull();
    });

    it('accepts a custom max age', () => {
      const ageMs = 30 * 60 * 1000; // 30 minutes
      const oldTimestamp = Date.now() - 20 * 60 * 1000; // 20 minutes ago
      const state = encodeOAuthState({
        userId: 'user_abc',
        subAgencyId: null,
        timestamp: oldTimestamp,
      });

      const decoded = decodeOAuthState(state, ageMs);
      expect(decoded.userId).toBe('user_abc');
    });
  });
});
