# Changelog

All notable changes to Coldflow are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-16

First tagged baseline. Establishes a stable target for external contributors.

### Added

- **DMARC validation.** Enter a domain and see SPF / DKIM / DMARC records inline.
  Also shipped as a standalone CLI: [`npx dmarc-doctor`](https://github.com/pypesdev/dmarc-doctor).
- **Google SMTP integration.** Connect a Gmail account via OAuth and send through
  the connected account. Companion CLI for self-hosted SMTP transport
  diagnostics: [`npx smtp-warmer`](https://github.com/pypesdev/smtp-warmer).
- **CSV contact upload.** Import recipient lists from CSV with per-recipient
  variable substitution (`{first_name}`, etc.).
- **Single-step sequences.** Create a one-step campaign with basic
  personalization and a strict per-account sending limit.
- **Silent-reply automation.** Schedule a single follow-up when a prospect
  replies once and then goes quiet. Auto-cancels if they reply again before
  the follow-up sends.
- **Templates library.** Curated 10-template starter pack across sales,
  recruiting, partnership, warm-intro, and follow-up categories, each with
  YAML front-matter (subject, persona, use case, deliverability notes) and a
  plaintext body under 120 words. See [`templates/`](templates/) and
  [pypesdev/coldflow#11](https://github.com/pypesdev/coldflow/pull/11).
- **Campaigns list + detail pages.** Dashboard views for browsing existing
  campaigns and inspecting per-campaign state ([#19](https://github.com/pypesdev/coldflow/pull/19)).
- **GitHub Actions CI.** Every PR runs `tsc --noEmit`, `pnpm lint`, and
  `pnpm test:int` against a Postgres 16 service container
  ([#23](https://github.com/pypesdev/coldflow/pull/23)).

### Fixed

- **MIME RFC encoding.** Header B-encoding (RFC 2047) and quoted-printable
  body encoding (RFC 2045) so non-ASCII characters — em dashes, smart quotes,
  accents — render correctly across stricter MTAs instead of as mojibake
  ([#10](https://github.com/pypesdev/coldflow/pull/10)).

[Unreleased]: https://github.com/pypesdev/coldflow/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pypesdev/coldflow/releases/tag/v0.1.0
