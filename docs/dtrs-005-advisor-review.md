# DTRS-005 — Lived-experience advisor consent UX review

**Status:** Pending. Blocks first real-PHI flow (gating story per BACKLOG).
**Engineering side:** ready (DTRS-001 schema + DTRS-002 form merged).
**Coalition side:** schedule paid 90-min session per advisor, $100/session honorarium per FAG comp policy.

## Why this exists

Before any client data flows through the consent surface, the wording, the
default checkbox states, and the data-class vocabulary need to be reviewed by
people who have actually been on the receiving end of consent forms in
shelter / ED / legal-aid contexts. Reading-level, framing, and the plain-
language commitments all have to be vetted; a grade-6 Flesch-Kincaid score is
the floor, not the ceiling. The wording is in
[`src/lib/dtrs/consent-text.ts`](../src/lib/dtrs/consent-text.ts) — bump
`CURRENT_CONSENT_VERSION` whenever the wording changes.

## What to bring to the session

- Printed copy of [`/p/[ref]/consent/grant`](../src/app/p/[ref]/consent/grant/page.tsx)
  for each of the three consent types (PHI share, SMS, program eval).
- Printed handout from [`/app/coalition/sms/handout`](../src/app/app/coalition/sms/handout/page.tsx) for tone calibration.
- The `DATA_CLASSES` list (identity / health / housing_history / service_events).
- A blank legal pad — what *isn't* on the form should be heard, not just
  what's on it.

## Questions to ask

1. Does the framing assume things you wouldn't trust the coalition with at first
   contact? Where?
2. Are any of the bullet promises ones you'd doubt? Why?
3. Are the data-class checkboxes named in language someone in your shoes would
   actually use?
4. Is there a category of info that should be checkable but isn't? Is there one
   that shouldn't be checkable at all?
5. Where would you have walked away from this form if you'd encountered it
   during your worst week?

## What to capture

- Verbatim wording suggestions, by section.
- Defaults to flip (e.g. \"start with health *unchecked*\").
- Data-class additions or merges.
- Friction points in the flow that aren't about wording (e.g. \"the link
  came at the wrong moment\").
- A go / no-go on whether the engineering work is ready for first real
  client.

## After the session

- Bump `CURRENT_CONSENT_VERSION` in `src/db/schema/consents.ts` and
  `src/lib/dtrs/consent-text.ts` (they import from each other — keep in
  sync) and edit the copy to match the advisor's wording.
- File a follow-up issue per advisor session for any structural change
  (new data class, default flip, defaults that need to be configurable
  per partner).
- File the session notes here as `docs/dtrs-005-session-YYYY-MM-DD.md`.
- Pay the honorarium per OPRT-004's compensation tracker.

## Compensation policy

$100 per advisor per session, plus food and transit if the session is in
person. The coalition's frontline-advisory-group compensation tracker (OPRT-004)
records both. Pay at the time of the session, not after.
