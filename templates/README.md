# Coldflow templates

A small, opinionated library of cold email templates for the use cases that
actually drive replies. Plaintext, under ~120 words, one CTA per email.

These are content — markdown files you copy into the campaign builder. They
are not loaded by the app at runtime. For the in-app picker (`Browse
templates` button), see `src/lib/templates/catalog.ts`.

## Index

### Sales (3)
- [`sales/saas-pain-point.md`](sales/saas-pain-point.md) — open with a concrete
  symptom of the problem your product solves.
- [`sales/agency-case-study.md`](sales/agency-case-study.md) — lead with a peer
  outcome, not a pitch.
- [`sales/founder-direct.md`](sales/founder-direct.md) — founder-to-buyer
  honesty trade for early-stage selling.

### Recruiting (2)
- [`recruiting/passive-candidate.md`](recruiting/passive-candidate.md) — first
  touch to a happy, employed engineer.
- [`recruiting/founder-hiring.md`](recruiting/founder-hiring.md) — founder
  reaching out for the first or second engineer.

### Partnership (2)
- [`partnership/integration-proposal.md`](partnership/integration-proposal.md) —
  scoped product integration pitch.
- [`partnership/co-marketing.md`](partnership/co-marketing.md) — joint post,
  webinar, or list swap.

### Warm intro (2)
- [`warm-intro/mutual-connection.md`](warm-intro/mutual-connection.md) — when
  a shared contact has agreed to be named.
- [`warm-intro/event-followup.md`](warm-intro/event-followup.md) — convert a
  conference/dinner conversation into a real thread.

### Follow-up (1)
- [`follow-up/no-reply-bump.md`](follow-up/no-reply-bump.md) — single bump on
  a non-replier with a soft "give me an out" CTA.

## Format

Each template is a `.md` file with YAML front-matter and a plaintext body:

```yaml
---
id: sales_saas_pain_point
name: SaaS — Pain Point Opener
category: sales
persona: Who you are when you send this
use_case: When this template wins
deliverability_notes: |
  What to keep, what to swap, what trips spam filters.
subject: Noticed {{specific_signal}} at {{company}}
variables:
  - first_name
  - company
  - specific_signal
---

Hi {{first_name}},

...body...
```

`{{variable}}` placeholders match the syntax used by the in-app campaign
builder (see `src/lib/templates/catalog.ts`). Replace them per-recipient
before sending.

## How to load into Coldflow

Coldflow's MVP supports a single-step sequence with per-recipient
personalization. There is no separate "CSV upload" — the recipient list is
pasted into a textarea on the new-campaign page.

1. **Start a new campaign** — go to `/dashboard/campaigns/new` (page source:
   [`src/app/(frontend)/dashboard/campaigns/new/page.tsx`](../src/app/(frontend)/dashboard/campaigns/new/page.tsx)).
2. **Pick a connected sender** under *Send from*. If none are connected, set
   one up at `/dashboard/email-accounts` first.
3. **Paste recipients** into the *Recipients* textarea. One per line, comma,
   or semicolon. Optional `Name <email>` form is parsed by
   [`src/lib/recipientParser.ts`](../src/lib/recipientParser.ts), so a
   pasted CSV column works directly.
4. **Copy the template** — open the chosen file in this folder, copy
   `subject:` into the *Subject* field and the body (everything below the
   second `---`) into the *Body* field.
5. **Verify variables** — the form lists every `{{placeholder}}` it detected
   under *Variables in this template*. Match them against the front-matter
   `variables:` list.
6. **Create campaign** — Coldflow queues the emails through the configured
   sending limit (see `src/app/api/email-queue/process/route.ts`).

If you want the template available in the in-app *Browse templates* picker
instead of one-off copy/paste, add an entry to `TEMPLATES` in
[`src/lib/templates/catalog.ts`](../src/lib/templates/catalog.ts) and the
catalog test will enforce that every `{{variable}}` is declared.

## Deliverability notes that apply to every template

- Send plaintext. No tracking pixel, no signature image, no link in send #1
  unless the recipient asked for one.
- Personalize the variable that carries the email — the "specific signal" or
  "specific conversation detail" line. Generic versions get filtered.
- Stay under 120 words. Longer reads as marketing.
- Reply-bumps go on the same thread (`Re: {{previous_subject}}`), not a new
  one. Coldflow's silent-reply follow-up handles this automatically; see
  `Pending follow-ups` on the dashboard.
- One CTA per email. If you want two, send two emails.

## Contributing

New templates welcome. Keep the front-matter shape consistent, run a quick
spam-word pass before opening a PR, and aim for "useful as-is to a real
sender" over "clever".
