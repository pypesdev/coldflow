---
id: recruiting_passive_candidate
name: Recruiting — Passive Candidate
category: recruiting
persona: Hiring manager or in-house recruiter reaching out to a happy, employed engineer
use_case: First touch to a passive candidate. Designed to respect their time and earn a reply even from a "not looking" state.
deliverability_notes: |
  Lead with one specific thing from their work — generic "I came across your profile"
  reads as bulk mail and lands in Promotions. Disclose comp range up front; missing
  it is the #1 reason passives ignore recruiter mail. Keep under 120 words.
subject: {{role_title}} at {{company}} — open to a chat?
variables:
  - first_name
  - candidate_signal
  - role_title
  - company
  - team_focus
  - comp_range
  - sender_name
---

Hi {{first_name}},

{{candidate_signal}} is the reason I'm writing — that's the exact shape of work my team is hiring for.

We're looking for a {{role_title}} at {{company}}. Team is small, ships weekly, and is focused on {{team_focus}}. Comp range is {{comp_range}} plus equity, fully remote.

Even if you're happy where you are, I'd love 20 minutes to swap notes and tell you what we're building. Worst case you walk away with context for whenever the timing's right.

Reply with a day that works and I'll send a couple of times.

— {{sender_name}}
