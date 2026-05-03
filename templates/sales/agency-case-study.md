---
id: sales_agency_case_study
name: Agency — Case Study Wedge
category: sales
persona: Agency principal or BDR selling done-for-you services to a similar-shape buyer
use_case: Cold open that leads with a peer outcome, not a pitch. Strongest when the case study company is one tier ahead of the prospect.
deliverability_notes: |
  Lead with the peer name, not the offer. Replace {{case_study_company}} with a real
  customer (with permission). Avoid the phrases "100%", "best price", and "act now".
  120-word cap. One soft CTA, no calendar link in send #1.
subject: How {{case_study_company}} hit {{outcome_metric}}
variables:
  - first_name
  - company
  - case_study_company
  - outcome_metric
  - service_area
  - timeline
  - sender_name
---

Hi {{first_name}},

We worked with {{case_study_company}} on {{service_area}} and they hit {{outcome_metric}} in {{timeline}}. Their team looked a lot like yours at {{company}} a year ago.

Not pitching — just thought the playbook might be useful context for whatever you're already running.

If a 20-minute walkthrough of what worked (and what we'd do differently) is interesting, reply with a day that's good and I'll send a couple of times. If you'd rather just see the writeup, say "send the writeup" and I will.

— {{sender_name}}
