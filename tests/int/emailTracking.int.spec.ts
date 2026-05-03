import { describe, it, expect } from 'vitest';
import {
  buildClickUrl,
  buildTrackingPixel,
  injectTracking,
} from '@/lib/emailTracking';

const opts = {
  baseUrl: 'https://app.example.com',
  trackingId: 'tracking_abc',
};

describe('buildTrackingPixel', () => {
  it('points at the configured base URL and tracking id', () => {
    expect(buildTrackingPixel(opts)).toBe(
      '<img src="https://app.example.com/api/email-tracking/pixel/tracking_abc.png" width="1" height="1" alt="" style="display:none;" />'
    );
  });
});

describe('buildClickUrl', () => {
  it('URL-encodes the destination', () => {
    expect(buildClickUrl(opts, 'https://x.com/?q=hello world')).toBe(
      'https://app.example.com/api/email-tracking/click/tracking_abc?url=https%3A%2F%2Fx.com%2F%3Fq%3Dhello%20world'
    );
  });
});

describe('injectTracking', () => {
  it('returns the body unchanged when no trackingId is provided', () => {
    const out = injectTracking('<p>hi</p>', { ...opts, trackingId: '' });
    expect(out).toBe('<p>hi</p>');
  });

  it('appends the open-pixel when there is no </body>', () => {
    const out = injectTracking('<p>hi</p>', opts);
    expect(out).toContain('<p>hi</p>');
    expect(out).toContain(
      '/api/email-tracking/pixel/tracking_abc.png'
    );
    expect(out.endsWith('display:none;" />')).toBe(true);
  });

  it('inserts the open-pixel before </body> when present', () => {
    const out = injectTracking(
      '<html><body><p>hi</p></body></html>',
      opts
    );
    expect(out).toBe(
      '<html><body><p>hi</p><img src="https://app.example.com/api/email-tracking/pixel/tracking_abc.png" width="1" height="1" alt="" style="display:none;" /></body></html>'
    );
  });

  it('rewrites http(s) anchor hrefs through the click tracker', () => {
    const out = injectTracking(
      '<a href="https://x.com/page">click</a>',
      opts
    );
    expect(out).toContain(
      'href="https://app.example.com/api/email-tracking/click/tracking_abc?url=https%3A%2F%2Fx.com%2Fpage"'
    );
    expect(out).toContain('>click</a>');
  });

  it('preserves single-quoted href quoting', () => {
    const out = injectTracking(
      "<a href='https://x.com/page'>click</a>",
      opts
    );
    expect(out).toContain(
      "href='https://app.example.com/api/email-tracking/click/tracking_abc?url=https%3A%2F%2Fx.com%2Fpage'"
    );
  });

  it('preserves attributes that come before href', () => {
    const out = injectTracking(
      '<a class="cta" target="_blank" href="https://x.com">click</a>',
      opts
    );
    expect(out).toMatch(
      /<a class="cta" target="_blank" href="https:\/\/app\.example\.com\/api\/email-tracking\/click\/tracking_abc\?url=https%3A%2F%2Fx\.com">click<\/a>/
    );
  });

  it('does not rewrite non-http(s) hrefs (mailto, tel, anchors)', () => {
    const html =
      '<a href="mailto:a@b.com">mail</a>' +
      '<a href="tel:+15551234">tel</a>' +
      '<a href="#section">anchor</a>';
    const out = injectTracking(html, opts);
    expect(out).toContain('href="mailto:a@b.com"');
    expect(out).toContain('href="tel:+15551234"');
    expect(out).toContain('href="#section"');
  });

  it('does not double-rewrite an already-tracked link', () => {
    const html = `<a href="https://app.example.com/api/email-tracking/click/tracking_abc?url=https%3A%2F%2Fx.com">click</a>`;
    const out = injectTracking(html, opts);
    expect(out).toBe(html + buildTrackingPixel(opts));
  });

  it('is idempotent with respect to the open-pixel', () => {
    const once = injectTracking('<p>hi</p>', opts);
    const twice = injectTracking(once, opts);
    expect(twice).toBe(once);
  });

  it('rewrites multiple links in a single body', () => {
    const html =
      '<a href="https://x.com/a">A</a><a href="https://y.com/b">B</a>';
    const out = injectTracking(html, opts);
    expect(out).toContain(
      'url=https%3A%2F%2Fx.com%2Fa'
    );
    expect(out).toContain(
      'url=https%3A%2F%2Fy.com%2Fb'
    );
  });
});
