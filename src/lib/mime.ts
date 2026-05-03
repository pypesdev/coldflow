/**
 * Minimal RFC-correct MIME helpers for outbound email.
 *
 * The previous implementation declared `Content-Transfer-Encoding: 7bit` and
 * then wrote raw UTF-8 into both headers and bodies. That violates RFC 2045
 * (7bit forbids bytes > 127), corrupts subjects with non-ASCII (em dashes,
 * curly quotes, accented characters), and can be rejected by stricter MTAs
 * when relayed via Gmail's external send.
 *
 * This module produces a message that is safe for any UTF-8 input:
 *   - Headers with non-ASCII go through RFC 2047 "B" encoding.
 *   - Bodies with non-ASCII use quoted-printable transfer encoding.
 *   - All-ASCII inputs are emitted as-is so existing tests / messages stay
 *     byte-equivalent where possible.
 *
 * Everything here is intentionally pure (no I/O, no globals). The Gmail-aware
 * pieces — token refresh, tracking pixel injection, link rewriting — live in
 * separate modules so this one can be unit-tested in isolation.
 */

const CRLF = '\r\n';

export function isAscii(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 127) return false;
  }
  return true;
}

/**
 * Encode a single header value (e.g. a Subject) per RFC 2047 if it contains
 * any non-ASCII characters, otherwise return it unchanged.
 *
 * Uses base64 ("B") encoding because the body of cold-email subjects is often
 * mostly non-ASCII when localized, and B-encoding handles arbitrary bytes
 * cleanly without escaping concerns.
 */
export function encodeMimeHeaderValue(value: string): string {
  if (isAscii(value)) return value;

  // Splitting on grapheme clusters is overkill for our use case (subjects),
  // but we do need to split into chunks <= 75 chars total per encoded-word.
  // The encoded-word overhead is `=?UTF-8?B??=` = 12 chars, so the base64
  // payload must be <= 63 chars => <= 47 bytes of UTF-8 (since
  // ceil(47/3)*4 = 64 ... actually 63, so cap at 45 to be safe).
  const maxBytesPerWord = 45;

  const utf8 = Buffer.from(value, 'utf8');
  const words: string[] = [];
  for (let offset = 0; offset < utf8.length; ) {
    // Find the largest valid UTF-8 boundary <= maxBytesPerWord
    let end = Math.min(offset + maxBytesPerWord, utf8.length);
    while (end > offset && (utf8[end] & 0b1100_0000) === 0b1000_0000) {
      // Don't split inside a UTF-8 continuation byte sequence
      end--;
    }
    const chunk = utf8.subarray(offset, end);
    words.push(`=?UTF-8?B?${chunk.toString('base64')}?=`);
    offset = end;
  }

  // Encoded-words on the same header line are joined with a space; receivers
  // collapse the space when decoding adjacent encoded-words.
  return words.join(' ');
}

/**
 * Render an address header value `Display Name <email@example.com>` with the
 * display name properly encoded. If there is no name, returns the bare email.
 *
 * The email itself is kept ASCII (we don't support EAI / SMTPUTF8 here);
 * the caller is responsible for validating that.
 */
export function formatAddressHeader(email: string, name?: string | null): string {
  if (!name || name.length === 0) return email;

  if (isAscii(name)) {
    // Quote the name when it contains characters that have meaning in
    // address syntax. RFC 5322 specials list, restricted to what we care
    // about plus dots in informal usage.
    const needsQuoting = /[(),<>@;:\\"\[\]]/.test(name);
    if (needsQuoting) {
      // Escape backslashes and quotes inside the quoted-string.
      const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `"${escaped}" <${email}>`;
    }
    return `${name} <${email}>`;
  }

  return `${encodeMimeHeaderValue(name)} <${email}>`;
}

/**
 * Encode a body string with quoted-printable per RFC 2045 §6.7.
 *
 * Restrictions enforced:
 *   - Lines must not exceed 76 characters (we use soft line breaks "=\r\n").
 *   - "=" itself must be encoded.
 *   - Trailing space/tab on a line must be encoded.
 *   - High-bit bytes are encoded.
 *   - Existing CRLF / LF line breaks become hard line breaks (CRLF) and do
 *     not count toward the 76-char limit.
 */
export function encodeQuotedPrintable(input: string): string {
  const utf8 = Buffer.from(input, 'utf8');
  // We process the source as UTF-8 bytes and emit ASCII output. We split on
  // line breaks first so soft-wrap doesn't cross intentional newlines.
  const out: string[] = [];

  // Normalize all line endings to LF for splitting; we'll re-emit CRLF.
  const normalized = utf8.toString('binary').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let lineOut = '';
    let lineLen = 0;

    const flushSoftBreak = () => {
      out.push(lineOut + '=');
      lineOut = '';
      lineLen = 0;
    };

    for (let i = 0; i < line.length; i++) {
      const byte = line.charCodeAt(i); // safe because of binary->latin1 mapping
      const isLast = i === line.length - 1;

      let encoded: string;
      if (byte === 0x3d) {
        // '='
        encoded = '=3D';
      } else if (byte === 0x09 || byte === 0x20) {
        // tab or space — must be encoded if it's the last char on a line
        if (isLast) {
          encoded = byte === 0x09 ? '=09' : '=20';
        } else {
          encoded = String.fromCharCode(byte);
        }
      } else if (byte >= 0x21 && byte <= 0x7e) {
        // Printable ASCII (excluding '=' handled above)
        encoded = String.fromCharCode(byte);
      } else {
        // High-bit / control byte
        encoded = '=' + byte.toString(16).toUpperCase().padStart(2, '0');
      }

      // Soft-wrap to keep lines <= 76 chars (the soft break "=" itself
      // counts toward the limit, so we wrap at 75).
      if (lineLen + encoded.length > 75) {
        flushSoftBreak();
      }

      lineOut += encoded;
      lineLen += encoded.length;
    }

    out.push(lineOut);
  }

  return out.join(CRLF);
}

export interface MimeMessageOptions {
  fromEmail: string;
  fromName?: string | null;
  toEmail: string;
  toName?: string | null;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  /**
   * Optional extra headers (already RFC-correct on the value side; the
   * builder only handles the name-value join).
   */
  extraHeaders?: Array<[string, string]>;
}

/**
 * Build a multipart/alternative MIME message body suitable for handing to
 * Gmail's `users.messages.send` (which accepts a base64url-encoded RFC 2822
 * message in the `raw` field). The caller is responsible for the final
 * base64url encoding step — this function returns a plain string.
 */
export function buildMimeMessage(options: MimeMessageOptions): string {
  if (!options.bodyText || options.bodyText.length === 0) {
    throw new Error('bodyText is required');
  }

  const boundary = `----=_Part_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;

  const headers: Array<[string, string]> = [
    ['From', formatAddressHeader(options.fromEmail, options.fromName ?? null)],
    ['To', formatAddressHeader(options.toEmail, options.toName ?? null)],
    ['Subject', encodeMimeHeaderValue(options.subject)],
    ['MIME-Version', '1.0'],
    ['Content-Type', `multipart/alternative; boundary="${boundary}"`],
  ];
  if (options.extraHeaders) headers.push(...options.extraHeaders);

  const headerLines = headers.map(([name, value]) => `${name}: ${value}`);

  const parts: string[] = [];

  // text/plain part
  parts.push([
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    `Content-Transfer-Encoding: ${isAscii(options.bodyText) ? '7bit' : 'quoted-printable'}`,
    '',
    isAscii(options.bodyText) ? options.bodyText : encodeQuotedPrintable(options.bodyText),
  ].join(CRLF));

  // text/html part (optional)
  if (options.bodyHtml && options.bodyHtml.length > 0) {
    const html = options.bodyHtml;
    parts.push([
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      `Content-Transfer-Encoding: ${isAscii(html) ? '7bit' : 'quoted-printable'}`,
      '',
      isAscii(html) ? html : encodeQuotedPrintable(html),
    ].join(CRLF));
  }

  parts.push(`--${boundary}--`);

  return [...headerLines, '', parts.join(CRLF + CRLF)].join(CRLF);
}

/**
 * Encode a raw RFC 2822 message string into the base64url form Gmail's
 * `messages.send` requires (`raw` field).
 */
export function toGmailRawString(message: string): string {
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
