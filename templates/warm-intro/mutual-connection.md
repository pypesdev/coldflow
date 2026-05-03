---
id: warm_intro_mutual_connection
name: Warm Intro — Mutual Connection
category: warm-intro
persona: Anyone reaching out after a referral from a shared contact (investor, peer founder, ex-colleague)
use_case: First touch where a mutual contact has agreed to be named. Highest-converting cold email there is — don't waste it.
deliverability_notes: |
  Always ask the mutual contact's permission before naming them. Reply rates drop
  hard if they didn't actually expect you to mention them. Keep it short — under 90
  words is ideal. The mutual's name does the work; the email shouldn't.
subject: {{mutual_contact}} suggested I reach out
variables:
  - first_name
  - mutual_contact
  - your_relevance
  - their_problem_area
  - sender_name
---

Hi {{first_name}},

{{mutual_contact}} mentioned you might be running into {{their_problem_area}} and suggested I get in touch — {{your_relevance}}.

I won't pitch anything in this email; happy to either send a 2-minute walkthrough video or grab 20 minutes whenever it's easy.

Which is better for you?

— {{sender_name}}
