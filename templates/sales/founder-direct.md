---
id: sales_founder_direct
name: Sales — Founder Direct
category: sales
persona: Founder selling early — under 100 customers, willing to do the work themselves
use_case: Personal note from a founder to a target buyer. Trades polish for honesty. Best at small ACVs where the founder is still the best closer.
deliverability_notes: |
  Plaintext only. No tracking pixel, no signature image. The "I built this" framing
  carries the email — avoid corporate phrasing. Skip words like "solution", "leverage",
  "synergy". Stay under 120 words; longer reads as marketing.
subject: Built this for teams like {{company}}
variables:
  - first_name
  - company
  - product_name
  - core_use_case
  - my_company
  - sender_name
---

Hi {{first_name}},

Quick one — I'm the founder of {{my_company}}. Built {{product_name}} after watching three teams burn weeks on {{core_use_case}} the hard way.

Still small enough that I do onboarding personally and ship fixes the same week. I'd rather lose you than oversell, so if it isn't a fit I'll say so on the call.

Worth 20 minutes this week or next? If now isn't the moment, totally fine — happy to circle back in a quarter.

— {{sender_name}}
