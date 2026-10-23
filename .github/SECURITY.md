# Security Policy

Coldflow is open-source cold-email infrastructure. The threat model + how to report:

## Reporting a vulnerability

Email **security@coldflow.dev** with:

- A clear reproduction
- The affected version (git SHA or release tag)
- Your contact for follow-up

We will acknowledge within **72 hours** and aim to triage within **7 days**.

Do **not** open a public issue for security reports. Open issues are for feature requests and bugs that are not security-sensitive.

## Supported versions

Only `main` is supported. If you self-host, update frequently — security patches are not back-ported.

## Scope

In scope:

- Authentication / authorization bypass
- Secret / token leakage (OAuth tokens, SMTP passwords, API keys)
- SQL / NoSQL injection, RCE
- CSRF on sensitive routes
- IDOR on multi-tenant resources (email accounts, campaigns, contacts)
- Dependency vulnerabilities we have not yet patched

Out of scope:

- Self-DoS (no auth, flooding your own instance)
- Social engineering of maintainers
- Issues in third-party services (SendGrid, Vercel, Payload CMS) — report upstream
- Missing security headers that don't lead to a concrete attack
- Rate-limit tuning disputes

## Operator responsibilities

If you deploy coldflow:

- **You are the sender.** Your IP reputation, your SPF/DKIM/DMARC, your abuse@ handling. Compliance with CAN-SPAM / GDPR is on you.
- **Rotate `GMAIL_ENCRYPTION_KEY` yearly** at minimum. Keep it out of git.
- **Lock down signup** (`COLDFLOW_SIGNUP_MODE=invite-only`) on any public deployment.
- **Monitor `email_account.status = 'error'`** — a compromised OAuth token will show up here first.

## Credit

We'll credit researchers in release notes unless you prefer anonymity. No bug bounty today; a thank-you and a link to your handle is what we offer.
