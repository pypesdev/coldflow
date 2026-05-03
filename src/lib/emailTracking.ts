/**
 * Open + click tracking helpers for outbound HTML email.
 *
 * Pure transformations: takes an HTML body and a tracking ID, returns a new
 * HTML body with a 1x1 open-pixel and rewritten links pointing at our click
 * tracker. No I/O. The base URL is passed in by the caller so this module
 * stays trivially testable.
 *
 * Idempotency: links that already point at our click tracker are left alone,
 * and the open-pixel is appended exactly once. Calling `injectTracking`
 * twice on the same body yields the same output as calling it once.
 */

const PIXEL_MARKER = '/api/email-tracking/pixel/';
const CLICK_PREFIX = '/api/email-tracking/click/';

export interface InjectTrackingOptions {
  baseUrl: string;
  trackingId: string;
}

export function buildTrackingPixel(opts: InjectTrackingOptions): string {
  return `<img src="${opts.baseUrl}${PIXEL_MARKER}${opts.trackingId}.png" width="1" height="1" alt="" style="display:none;" />`;
}

export function buildClickUrl(
  opts: InjectTrackingOptions,
  destinationUrl: string
): string {
  return `${opts.baseUrl}${CLICK_PREFIX}${opts.trackingId}?url=${encodeURIComponent(destinationUrl)}`;
}

export function injectTracking(
  html: string,
  opts: InjectTrackingOptions
): string {
  if (!html || !opts.trackingId) return html;

  const pixel = buildTrackingPixel(opts);
  const clickPrefix = `${opts.baseUrl}${CLICK_PREFIX}`;

  // Rewrite links — match the full <a ... href="..." ...> / <a ... href='...' ...>
  // attribute, leaving the rest of the tag untouched.
  const linkRegex = /<a\s+([^>]*?)href\s*=\s*(["'])([^"']+)\2/gi;
  let rewritten = html.replace(linkRegex, (match, attrsBefore: string, quote: string, url: string) => {
    // Skip if already pointing at our click tracker.
    if (url.startsWith(clickPrefix) || url.includes(CLICK_PREFIX)) {
      return match;
    }
    // Skip non-http(s) links — mailto:, tel:, anchors, javascript: should not
    // be rewritten. (javascript: should never appear in our outbound mail
    // anyway, but we guard against it.)
    if (!/^https?:\/\//i.test(url)) {
      return match;
    }
    const trackingUrl = buildClickUrl(opts, url);
    return `<a ${attrsBefore || ''}href=${quote}${trackingUrl}${quote}`;
  });

  // Append the open-pixel exactly once. If a previous pass already inserted
  // it, leave the body alone so this function stays idempotent.
  if (!rewritten.includes(`${PIXEL_MARKER}${opts.trackingId}`)) {
    if (rewritten.includes('</body>')) {
      rewritten = rewritten.replace('</body>', `${pixel}</body>`);
    } else {
      rewritten += pixel;
    }
  }

  return rewritten;
}
