import { describe, expect, it } from 'vitest'
import { verifyCronAuth } from '@/lib/cronAuth'

describe('verifyCronAuth', () => {
  it('returns ok when header matches the secret', () => {
    const r = verifyCronAuth({
      authorizationHeader: 'Bearer s3cret',
      cronSecret: 's3cret',
    })
    expect(r).toEqual({ ok: true })
  })

  it('returns 500 when CRON_SECRET is not configured', () => {
    expect(
      verifyCronAuth({
        authorizationHeader: 'Bearer anything',
        cronSecret: undefined,
      }),
    ).toEqual({ ok: false, status: 500, error: 'Server misconfiguration' })
  })

  it('returns 500 even with empty-string secret (treats falsy as misconfigured)', () => {
    expect(
      verifyCronAuth({
        authorizationHeader: 'Bearer ',
        cronSecret: '',
      }),
    ).toEqual({ ok: false, status: 500, error: 'Server misconfiguration' })
  })

  it('returns 401 when header is missing', () => {
    expect(
      verifyCronAuth({
        authorizationHeader: null,
        cronSecret: 's3cret',
      }),
    ).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
  })

  it('returns 401 when header is empty string', () => {
    expect(
      verifyCronAuth({
        authorizationHeader: '',
        cronSecret: 's3cret',
      }),
    ).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
  })

  it('returns 401 when header has wrong scheme', () => {
    expect(
      verifyCronAuth({
        authorizationHeader: 'Basic s3cret',
        cronSecret: 's3cret',
      }),
    ).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
  })

  it('returns 401 when secret value does not match', () => {
    expect(
      verifyCronAuth({
        authorizationHeader: 'Bearer wrong',
        cronSecret: 's3cret',
      }),
    ).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
  })

  it('is case-sensitive on the bearer scheme (defensive)', () => {
    expect(
      verifyCronAuth({
        authorizationHeader: 'bearer s3cret',
        cronSecret: 's3cret',
      }),
    ).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
  })

  it('does not strip surrounding whitespace from the header', () => {
    expect(
      verifyCronAuth({
        authorizationHeader: ' Bearer s3cret',
        cronSecret: 's3cret',
      }),
    ).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
  })

  it('treats different secrets with the same prefix as unauthorized', () => {
    expect(
      verifyCronAuth({
        authorizationHeader: 'Bearer s3cret-x',
        cronSecret: 's3cret',
      }),
    ).toEqual({ ok: false, status: 401, error: 'Unauthorized' })
  })
})
