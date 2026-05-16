---
id: sales_saas_pain_point
name: SaaS — Pain Point Opener
category: sales
persona: SaaS founder or AE selling into product/engineering teams
use_case: Cold open to a buyer where you've spotted a concrete symptom of the problem your product solves.
deliverability_notes: |
  Keep it under 120 words. No links in the first send (calendar offered as text).
  Avoid the words "free", "guarantee", and "limited time". One question, one CTA.
  Personalize {{specific_signal}} per recipient — generic versions get filtered.
subject: Noticed {{specific_signal}} at {{company}}
variables:
  - first_name
  - company
  - specific_signal
  - pain_outcome
  - product_name
  - sender_name
---

Hi {{first_name}},

Saw {{specific_signal}} at {{company}} — usually that means {{pain_outcome}} is showing up somewhere in the week. We hear it most from teams that grew past the point where one person could hold the whole flow in their head.

{{product_name}} fixes the part nobody wants to own: the boring middle of the pipeline that breaks quietly until a customer notices.

Worth 15 minutes to see whether the shape of your problem matches what we usually see? If it doesn't, I'll say so and we both move on.

— {{sender_name}}
