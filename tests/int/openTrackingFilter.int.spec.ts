import { describe, expect, it } from 'vitest'
import { classifyPixelRequest } from '@/lib/openTrackingFilter'

const sentAt = new Date('2026-05-03T12:00:00Z')
const longAfter = new Date('2026-05-03T13:00:00Z')

describe('classifyPixelRequest — UA-based prefetcher detection', () => {
  it('flags Gmail image proxy', () => {
    const r = classifyPixelRequest({
      userAgent:
        'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko; GoogleImageProxy)',
      sentAt,
      now: longAfter,
    })
    expect(r).toEqual({ isPrefetcher: true, reason: 'gmail_image_proxy' })
  })

  it('flags Apple Mail Privacy Protection by UA', () => {
    expect(
      classifyPixelRequest({
        userAgent: 'com.apple.mobilemail/MailPrivacyProtection',
        sentAt,
        now: longAfter,
      }),
    ).toEqual({ isPrefetcher: true, reason: 'apple_mpp' })
    expect(
      classifyPixelRequest({
        userAgent: 'MaskedEmail/1.0',
        sentAt,
        now: longAfter,
      }),
    ).toEqual({ isPrefetcher: true, reason: 'apple_mpp' })
  })

  it('flags Outlook Safe Links / Defender scanners', () => {
    expect(
      classifyPixelRequest({
        userAgent: 'BingPreview/1.0b',
        sentAt,
        now: longAfter,
      }).isPrefetcher,
    ).toBe(true)
    expect(
      classifyPixelRequest({
        userAgent: 'Microsoft Office SafeLinks Scanner',
        sentAt,
        now: longAfter,
      }).isPrefetcher,
    ).toBe(true)
  })

  it('flags known security scanner UAs', () => {
    for (const vendor of [
      'Bitdefender',
      'Mimecast',
      'Proofpoint',
      'Barracuda',
      'Sophos',
      'TrendMicro',
      'Symantec',
      'McAfee',
    ]) {
      const r = classifyPixelRequest({
        userAgent: `${vendor}-AV/1.0`,
        sentAt,
        now: longAfter,
      })
      expect(r).toEqual({ isPrefetcher: true, reason: 'known_scanner' })
    }
  })
})

describe('classifyPixelRequest — time-window heuristic', () => {
  it('flags hits inside the send window even with a real-looking UA', () => {
    const r = classifyPixelRequest({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      sentAt,
      now: new Date(sentAt.getTime() + 5_000), // 5s after send
    })
    expect(r).toEqual({ isPrefetcher: true, reason: 'sub_send_window' })
  })

  it('does not flag hits outside the send window', () => {
    const r = classifyPixelRequest({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      sentAt,
      now: new Date(sentAt.getTime() + 60_000), // 1 minute after send
    })
    expect(r).toEqual({ isPrefetcher: false })
  })

  it('honors a custom send-window threshold', () => {
    const r = classifyPixelRequest({
      userAgent: 'Mozilla/5.0',
      sentAt,
      now: new Date(sentAt.getTime() + 45_000), // 45s
      minSendWindowSeconds: 60,
    })
    expect(r).toEqual({ isPrefetcher: true, reason: 'sub_send_window' })
  })

  it('ignores invalid sentAt strings', () => {
    expect(
      classifyPixelRequest({
        userAgent: 'Mozilla/5.0',
        sentAt: 'not-a-date',
        now: new Date(),
      }),
    ).toEqual({ isPrefetcher: false })
  })

  it('does not flag hits before sentAt (negative age)', () => {
    // Defensive: if sentAt is in the future for any reason, do not flag —
    // it is more likely a clock-skew bug than a prefetcher.
    expect(
      classifyPixelRequest({
        userAgent: 'Mozilla/5.0',
        sentAt: new Date(sentAt.getTime() + 60_000),
        now: sentAt,
      }),
    ).toEqual({ isPrefetcher: false })
  })

  it('skips the time-window check entirely when sentAt is missing', () => {
    expect(
      classifyPixelRequest({
        userAgent: 'Mozilla/5.0',
        now: new Date(),
      }),
    ).toEqual({ isPrefetcher: false })
  })
})

describe('classifyPixelRequest — passthrough cases', () => {
  it('does not flag a normal browser UA outside the send window', () => {
    const r = classifyPixelRequest({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      sentAt,
      now: longAfter,
    })
    expect(r).toEqual({ isPrefetcher: false })
  })

  it('does not flag empty / missing UA on its own', () => {
    expect(
      classifyPixelRequest({ userAgent: '', sentAt, now: longAfter }),
    ).toEqual({ isPrefetcher: false })
    expect(
      classifyPixelRequest({ userAgent: null, sentAt, now: longAfter }),
    ).toEqual({ isPrefetcher: false })
    expect(
      classifyPixelRequest({ userAgent: undefined, sentAt, now: longAfter }),
    ).toEqual({ isPrefetcher: false })
  })

  it('matches case-insensitively', () => {
    expect(
      classifyPixelRequest({
        userAgent: 'googleimageproxy/1.0',
        sentAt,
        now: longAfter,
      }),
    ).toEqual({ isPrefetcher: true, reason: 'gmail_image_proxy' })
  })

  it('matches the UA signal even before the send-window timer would fire', () => {
    // A scanner UA inside the window should classify as the scanner reason,
    // not "sub_send_window" — preserves the most specific diagnostic.
    const r = classifyPixelRequest({
      userAgent: 'GoogleImageProxy',
      sentAt,
      now: new Date(sentAt.getTime() + 3_000),
    })
    expect(r).toEqual({ isPrefetcher: true, reason: 'gmail_image_proxy' })
  })
})
