/**
 * Open-tracking prefetcher detection.
 *
 * Email-client scanners fetch tracking pixels before the human ever sees the
 * message — Gmail's image proxy pre-caches every image, Apple Mail Privacy
 * Protection (MPP) does the same on iOS 15+, corporate security gateways
 * scan everything inbound. Counting these as opens silently inflates the
 * open-rate metric to noise levels.
 *
 * This module classifies an incoming pixel request without DB or network
 * access, so it can be unit-tested deterministically.
 */

export type PrefetcherClassification =
  | { isPrefetcher: false }
  | {
      isPrefetcher: true
      reason:
        | 'gmail_image_proxy'
        | 'apple_mpp'
        | 'outlook_safelinks'
        | 'known_scanner'
        | 'sub_send_window'
    }

export type ClassifyInput = {
  userAgent: string | null | undefined
  ipAddress?: string | null
  sentAt?: Date | string | null
  now?: Date
  /** Min seconds between send and pixel hit before we trust it. Default 30. */
  minSendWindowSeconds?: number
}

/**
 * Classify a pixel request as either a real human open or a prefetcher.
 * Order of checks matters — most specific UA signals first, then a
 * blanket time-window heuristic.
 */
export function classifyPixelRequest(
  input: ClassifyInput,
): PrefetcherClassification {
  const ua = (input.userAgent ?? '').trim()

  if (matchesGmailImageProxy(ua)) {
    return { isPrefetcher: true, reason: 'gmail_image_proxy' }
  }

  if (matchesAppleMpp(ua, input.ipAddress)) {
    return { isPrefetcher: true, reason: 'apple_mpp' }
  }

  if (matchesOutlookSafelinks(ua)) {
    return { isPrefetcher: true, reason: 'outlook_safelinks' }
  }

  if (matchesKnownScanner(ua)) {
    return { isPrefetcher: true, reason: 'known_scanner' }
  }

  if (input.sentAt) {
    const sent =
      typeof input.sentAt === 'string' ? new Date(input.sentAt) : input.sentAt
    if (!Number.isNaN(sent.getTime())) {
      const now = input.now ?? new Date()
      const ageSeconds = (now.getTime() - sent.getTime()) / 1000
      const window = input.minSendWindowSeconds ?? 30
      // A real human cannot open a cold email within 30s of it being sent —
      // the inbox client hasn't even pushed the notification yet. Anything
      // hitting the pixel that fast is a server-side scanner.
      if (ageSeconds >= 0 && ageSeconds < window) {
        return { isPrefetcher: true, reason: 'sub_send_window' }
      }
    }
  }

  return { isPrefetcher: false }
}

function matchesGmailImageProxy(ua: string): boolean {
  // Google sets "GoogleImageProxy" in the UA when its server fetches inline
  // images on behalf of Gmail web clients before the user sees the message.
  return /GoogleImageProxy/i.test(ua)
}

function matchesAppleMpp(ua: string, ipAddress: string | null | undefined): boolean {
  // Apple MPP uses Apple's privacy relay; the UA is typically empty or
  // contains "Mail/" with a privacy-mask IP. Conservative match: explicit
  // Apple privacy strings + the well-known privacy-relay UA stub.
  if (/MaskedEmail|MailPrivacyProtection|com\.apple\.mobilemail/i.test(ua)) {
    return true
  }
  // Apple's privacy relay routes through known IP ranges; we don't ship
  // the full list, but treat empty-UA-plus-no-IP as suspicious only when
  // combined with the time-window check below. Don't flag here on UA alone.
  void ipAddress
  return false
}

function matchesOutlookSafelinks(ua: string): boolean {
  // Microsoft's Defender for Office 365 / Safe Links scans every link and
  // image. UA contains "BingPreview", "Microsoft Office Word", "Outlook",
  // or "MSIE 10.0" + "ms-office".
  return (
    /BingPreview|MSOffice|MSIE 10\.0.*ms-office|Microsoft-WebDAV-MiniRedir/i.test(
      ua,
    ) || /SafeLinks/i.test(ua)
  )
}

function matchesKnownScanner(ua: string): boolean {
  // Generic security-scanner / anti-spam UA patterns common in B2B inboxes.
  return /Bitdefender|Mimecast|Proofpoint|Barracuda|Sophos|TrendMicro|Symantec|McAfee|YahooMailProxy|Forcepoint/i.test(
    ua,
  )
}
