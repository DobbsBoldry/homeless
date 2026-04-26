# Daviess Coalition Eviction-Defense Triage — for KLA Owensboro

**Single-page leave-behind. ~5 minutes to read. Print landscape if attaching screenshots.**

> Status: SKELETON — engineering scaffolded the structure; Bo fills the
> bracketed copy and inserts the four screenshots once Sprint 5 ships
> to staging. Convert to PDF via the EVDT-021 pipeline (`pnpm tsx
> scripts/render-doc.ts docs/kla-demo-handout.md`) or pandoc.

---

## What this is, in three sentences

A daily triage tool that pulls forcible-detainer filings from Daviess
District Court, scores each filing for displacement risk using Claude,
and pre-drafts a tenant Answer that a KLA attorney reviews, edits, and
files. **It cuts the time from "case appears on the docket" to "client
has a draft Answer in hand" from days to minutes.** It's an attorney
multiplier — not an attorney replacement.

[Bo: tighten or replace the third sentence with whatever lands hardest in conversation.]

---

## The 5-step daily workflow

| Step | What you do | Time | Where |
|---|---|---|---|
| 1 | Get the morning email digest of the top-10 high-risk cases for today | passive | Inbox (7am Central) |
| 2 | Open the daily queue, scan the ranked list | 2–5 min | `/app/cases/queue` |
| 3 | Click into a case → review the Claude risk-score rationale + filing facts | 2 min | `/app/cases/filings/[id]` |
| 4 | Open the packet workspace → review and edit the AI-drafted Answer | 5–10 min | `/app/cases/filings/[id]/packet` |
| 5 | Approve and export the PDF → file with the court | 2 min | same page → "Export PDF" |

Total per case: **~15 minutes from open to filed Answer**, vs ~2 hours
without the AI scaffold.

[Bo: insert 4 screenshots — queue, case detail w/ score, packet review,
exported PDF. Engineering will hand these over from staging once
DEMO-001 has been run there.]

---

## What's AI-drafted vs. human-reviewed

Every AI-produced artifact in this system has a visible disclaimer and
a status flow that requires explicit attorney sign-off before it leaves
the platform. Specifically:

- **Risk scores** are advisory. The score is a sort-key for the daily
  queue, never a recommendation to act or not act on a case.
- **Response packets** carry an "AI-DRAFTED — REVIEW BY LICENSED
  ATTORNEY REQUIRED BEFORE FILING" header that cannot be edited away
  (the system rejects saves that strip it).
- **Status flow:** every packet is `draft` until you approve it,
  `approved` until you mark it filed, then `filed`. The PDF export
  is gated on `approved` status, so a draft that hasn't been reviewed
  cannot leave the system as a court-ready document.
- **No confidential client data is sent to Claude.** The risk-scoring
  prompt sees only the public filing facts (case number, plaintiff,
  cause type, amount, status, court, filed-at). Defendant addresses are
  scrubbed; defendant names are included only on the answer caption
  (where the court requires them).
- **Audit log:** every status transition, every export, every outcome
  recording is captured with the responsible attorney's id and a
  timestamp. Tampering is blocked at the database level.

[Bo: if the audience is risk-averse, lead with the audit log and the
"no confidential client data to Claude" point. If the audience is
ROI-focused, lead with the time savings.]

---

## What we measure → what success looks like

The platform tracks four KPIs visible at `/app/metrics`:

1. **Representation rate** — fraction of filings that get an
   attorney-reviewed response packet drafted. Phase-1 baseline goal:
   double whatever KLA's current capacity supports.
2. **Default-judgment rate** — fraction of cases (with any recorded
   outcome) that ended in default. Phase-1 goal: drive this DOWN by
   getting more represented cases to court.
3. **Favorable-outcome rate** — fraction of recorded outcomes that
   were dismissed, ruled for the defendant, or settled. Phase-1 goal:
   lift this for represented cases.
4. **Volume signals** — daily filings ingested, packets approved,
   packets filed — so the demo conversation can move from
   "this exists" to "what happened this week."

[Bo: if KLA Owensboro has internal numbers on representation rate or
default rate, drop them in here as a baseline next to the goal. The
contrast is the pitch.]

---

## What we need from KLA to ship the pilot

- **One attorney login** (real Clerk account, promoted to KLA
  attorney via the admin UI — takes 30 seconds).
- **One week of daily docket review** as a parallel run — KLA does it
  the normal way, the platform does it via this workflow, we compare
  outputs.
- **Feedback on packet quality** — what the AI got right, what it
  missed, what wording is non-negotiable for the court.
- **A signed BAA** is NOT required for the eviction-defense flow —
  every input is public court record.

---

**Questions?** [Bo: contact + reply-by date]

> Generated for the [DATE] demo. System version: see footer of any
> page in the platform. © Daviess Coalition Platform — internal
> reference, not for client distribution.
