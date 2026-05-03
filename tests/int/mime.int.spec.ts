import { describe, it, expect } from 'vitest';
import {
  buildMimeMessage,
  encodeMimeHeaderValue,
  encodeQuotedPrintable,
  formatAddressHeader,
  isAscii,
  toGmailRawString,
} from '@/lib/mime';

describe('isAscii', () => {
  it('returns true for empty + plain ASCII', () => {
    expect(isAscii('')).toBe(true);
    expect(isAscii('hello world')).toBe(true);
    expect(isAscii('Hi there 123 !@#$%')).toBe(true);
  });

  it('returns false for any non-ASCII byte', () => {
    expect(isAscii('hello — world')).toBe(false); // em dash
    expect(isAscii('café')).toBe(false);
    expect(isAscii('🚀')).toBe(false);
  });
});

describe('encodeMimeHeaderValue', () => {
  it('passes through ASCII unchanged', () => {
    expect(encodeMimeHeaderValue('Welcome to our product')).toBe(
      'Welcome to our product'
    );
  });

  it('B-encodes a header containing non-ASCII', () => {
    const out = encodeMimeHeaderValue('Welcome — Jared');
    expect(out.startsWith('=?UTF-8?B?')).toBe(true);
    expect(out.endsWith('?=')).toBe(true);
    // Round-trip
    const payload = out.slice('=?UTF-8?B?'.length, -2);
    expect(Buffer.from(payload, 'base64').toString('utf8')).toBe(
      'Welcome — Jared'
    );
  });

  it('emits multiple encoded-words for very long non-ASCII headers', () => {
    const long = 'Hé'.repeat(60); // ~120 UTF-8 bytes
    const out = encodeMimeHeaderValue(long);
    const words = out.split(' ');
    expect(words.length).toBeGreaterThan(1);
    for (const word of words) {
      expect(word.startsWith('=?UTF-8?B?')).toBe(true);
      expect(word.endsWith('?=')).toBe(true);
      // Each encoded-word total length must be <= 75 chars (RFC 2047 §2)
      expect(word.length).toBeLessThanOrEqual(75);
    }
    // Round-trip the full value
    const decoded = words
      .map((w) => Buffer.from(w.slice(10, -2), 'base64').toString('utf8'))
      .join('');
    expect(decoded).toBe(long);
  });

  it('does not split inside a multibyte UTF-8 sequence', () => {
    // 4-byte emoji that, if split mid-byte, would corrupt
    const value = '🚀'.repeat(20);
    const out = encodeMimeHeaderValue(value);
    const words = out.split(' ');
    const decoded = words
      .map((w) => Buffer.from(w.slice(10, -2), 'base64').toString('utf8'))
      .join('');
    expect(decoded).toBe(value);
  });
});

describe('formatAddressHeader', () => {
  it('returns the bare email when no name is given', () => {
    expect(formatAddressHeader('a@b.com')).toBe('a@b.com');
    expect(formatAddressHeader('a@b.com', null)).toBe('a@b.com');
    expect(formatAddressHeader('a@b.com', '')).toBe('a@b.com');
  });

  it('includes the display name unquoted when it is plain ASCII', () => {
    expect(formatAddressHeader('a@b.com', 'Jared Zwick')).toBe(
      'Jared Zwick <a@b.com>'
    );
  });

  it('quotes the name when it contains special characters', () => {
    expect(formatAddressHeader('a@b.com', 'Doe, John')).toBe(
      '"Doe, John" <a@b.com>'
    );
    expect(formatAddressHeader('a@b.com', 'Foo (bar)')).toBe(
      '"Foo (bar)" <a@b.com>'
    );
  });

  it('escapes quotes and backslashes inside a quoted name', () => {
    expect(formatAddressHeader('a@b.com', 'a"b')).toBe('"a\\"b" <a@b.com>');
    expect(formatAddressHeader('a@b.com', 'a\\b')).toContain('\\\\');
  });

  it('encodes a non-ASCII display name per RFC 2047', () => {
    const out = formatAddressHeader('a@b.com', 'Café Owner');
    expect(out).toMatch(/^=\?UTF-8\?B\?.+\?= <a@b\.com>$/);
  });
});

describe('encodeQuotedPrintable', () => {
  it('passes through ASCII printable characters', () => {
    expect(encodeQuotedPrintable('hello world')).toBe('hello world');
  });

  it('encodes the equals sign', () => {
    expect(encodeQuotedPrintable('a=b')).toBe('a=3Db');
  });

  it('encodes high-bit bytes', () => {
    expect(encodeQuotedPrintable('café')).toBe('caf=C3=A9');
  });

  it('encodes em dash to its UTF-8 bytes', () => {
    expect(encodeQuotedPrintable('a — b')).toBe('a =E2=80=94 b');
  });

  it('preserves CRLF / LF as hard line breaks', () => {
    const out = encodeQuotedPrintable('a\nb\r\nc');
    expect(out).toBe('a\r\nb\r\nc');
  });

  it('encodes trailing whitespace at end of line', () => {
    const out = encodeQuotedPrintable('hello \nworld\t');
    expect(out).toBe('hello=20\r\nworld=09');
  });

  it('soft-wraps lines longer than 76 characters', () => {
    const longLine = 'x'.repeat(200);
    const out = encodeQuotedPrintable(longLine);
    for (const line of out.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
    // After dropping the soft-break "=" markers and re-joining, we should
    // get the original content back.
    expect(out.replace(/=\r\n/g, '')).toBe(longLine);
  });
});

describe('buildMimeMessage', () => {
  it('throws when bodyText is empty', () => {
    expect(() =>
      buildMimeMessage({
        fromEmail: 'a@b.com',
        toEmail: 'c@d.com',
        subject: 's',
        bodyText: '',
      })
    ).toThrow(/bodyText/);
  });

  it('emits ASCII bodies as 7bit (byte-equivalent to the input)', () => {
    const msg = buildMimeMessage({
      fromEmail: 'a@b.com',
      toEmail: 'c@d.com',
      subject: 'Hello',
      bodyText: 'Hi there',
    });
    expect(msg).toContain('Content-Transfer-Encoding: 7bit');
    expect(msg).toContain('Hi there');
    // No quoted-printable encoding should appear for an all-ASCII body
    expect(msg).not.toContain('=20');
    expect(msg).not.toContain('=3D');
  });

  it('emits non-ASCII bodies as quoted-printable', () => {
    const msg = buildMimeMessage({
      fromEmail: 'a@b.com',
      toEmail: 'c@d.com',
      subject: 'Hello',
      bodyText: 'Hi — there',
    });
    expect(msg).toContain('Content-Transfer-Encoding: quoted-printable');
    expect(msg).toContain('=E2=80=94');
    // The raw em dash byte must NOT appear in the output of the encoded body
    // (it would be a 7bit-violating byte).
    expect(msg.includes('—')).toBe(false);
  });

  it('encodes a non-ASCII subject per RFC 2047', () => {
    const msg = buildMimeMessage({
      fromEmail: 'a@b.com',
      toEmail: 'c@d.com',
      subject: 'Welcome — Jared',
      bodyText: 'Hello',
    });
    expect(msg).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
    // Raw em dash must not appear in the Subject header.
    const subjectLine = msg
      .split('\r\n')
      .find((l) => l.startsWith('Subject:'))!;
    expect(subjectLine.includes('—')).toBe(false);
  });

  it('includes both text and html parts when bodyHtml is provided', () => {
    const msg = buildMimeMessage({
      fromEmail: 'a@b.com',
      toEmail: 'c@d.com',
      subject: 'Hello',
      bodyText: 'plain version',
      bodyHtml: '<p>html version</p>',
    });
    expect(msg).toContain('Content-Type: text/plain');
    expect(msg).toContain('Content-Type: text/html');
    expect(msg).toContain('plain version');
    expect(msg).toContain('<p>html version</p>');
    expect(msg).toContain('multipart/alternative');
  });

  it('omits the html part when bodyHtml is empty/null/undefined', () => {
    const msg = buildMimeMessage({
      fromEmail: 'a@b.com',
      toEmail: 'c@d.com',
      subject: 'Hello',
      bodyText: 'plain only',
      bodyHtml: '',
    });
    expect(msg).not.toContain('Content-Type: text/html');
  });

  it('uses CRLF as the line terminator', () => {
    const msg = buildMimeMessage({
      fromEmail: 'a@b.com',
      toEmail: 'c@d.com',
      subject: 'Hello',
      bodyText: 'Hi',
    });
    // Every newline must be a CRLF (no bare LF allowed in 2822 messages).
    expect(msg.includes('\n')).toBe(true);
    const bareLfs = (msg.match(/(?<!\r)\n/g) || []).length;
    expect(bareLfs).toBe(0);
  });

  it('renders the Subject and From/To headers in the right order', () => {
    const msg = buildMimeMessage({
      fromEmail: 'a@b.com',
      fromName: 'Jared',
      toEmail: 'c@d.com',
      toName: 'Recipient',
      subject: 'Hi',
      bodyText: 'Hi',
    });
    const headerSection = msg.split('\r\n\r\n')[0].split('\r\n');
    const fromIdx = headerSection.findIndex((l) => l.startsWith('From: '));
    const toIdx = headerSection.findIndex((l) => l.startsWith('To: '));
    const subjIdx = headerSection.findIndex((l) => l.startsWith('Subject: '));
    expect(fromIdx).toBeGreaterThanOrEqual(0);
    expect(toIdx).toBe(fromIdx + 1);
    expect(subjIdx).toBe(toIdx + 1);
    expect(headerSection[fromIdx]).toBe('From: Jared <a@b.com>');
    expect(headerSection[toIdx]).toBe('To: Recipient <c@d.com>');
    expect(headerSection[subjIdx]).toBe('Subject: Hi');
  });

  it('uses a unique boundary that does not appear inside the body', () => {
    const msg = buildMimeMessage({
      fromEmail: 'a@b.com',
      toEmail: 'c@d.com',
      subject: 'Hello',
      bodyText: 'Hi there',
      bodyHtml: '<p>Hi</p>',
    });
    const boundaryLine = msg
      .split('\r\n')
      .find((l) => l.startsWith('Content-Type: multipart/alternative'))!;
    const match = boundaryLine.match(/boundary="([^"]+)"/);
    expect(match).not.toBeNull();
    const boundary = match![1];
    // The body parts must reference the boundary, but the user-supplied
    // body text/html must not contain the boundary string.
    expect(msg.includes(`--${boundary}`)).toBe(true);
    expect(msg.includes(`--${boundary}--`)).toBe(true);
    // Verify boundary is well-formed: starts with "----=_Part_" prefix.
    expect(boundary.startsWith('----=_Part_')).toBe(true);
  });
});

describe('toGmailRawString', () => {
  it('produces a base64url-encoded string with no padding or +/ chars', () => {
    const raw = toGmailRawString('hello?>>~');
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    // Round-trip via base64url decoding
    const standard = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
    expect(Buffer.from(padded, 'base64').toString('utf8')).toBe('hello?>>~');
  });

  it('round-trips a full UTF-8 mime message', () => {
    const msg = buildMimeMessage({
      fromEmail: 'a@b.com',
      toEmail: 'c@d.com',
      subject: 'Welcome — Jared',
      bodyText: 'Hi — there',
    });
    const encoded = toGmailRawString(msg);
    const standard = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
    expect(Buffer.from(padded, 'base64').toString('utf8')).toBe(msg);
  });
});
