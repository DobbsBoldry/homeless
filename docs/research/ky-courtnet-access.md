# Kentucky Court Eviction Filing Data — Access Options

**Status:** research memo
**Author:** Claude (research session, reviewed by Bo)
**Date:** 2026-04-25
**Scope:** Daviess District Court (Owensboro, KY) forcible-detainer filings, daily cadence, Phase-1 budget. Public court records only — no PHI.

---

## Recommendation (TL;DR)

**Build a polite daily scraper against the public KCOJ guest docket portal at `https://kcoj.kycourts.net/dockets/`, filtered to Daviess / District / Forcible Detainer, and complement it with a paid CourtNet 2.0 subscription (~$5–$50/mo) under a sponsoring KY-licensed attorney for case-detail enrichment.** Treat the LSC Civil Court Data Initiative as a sanity-check baseline (county-level monthly aggregates), not a primary source. Do not bet the pilot on a vendor (UniCourt / Trellis / Docket Alarm) — coverage of KY District Court forcible-detainer dockets at case level is unverified and pricing is enterprise-scale. Open-records requests to AOC for bulk case data will be denied.

This gets us flowing within ~2 weeks at <$100/mo recurring, with one significant fragility: the scraper breaks if KCOJ redesigns the docket portal (low-frequency event historically, but real). The CourtNet attorney subscription is the backstop — it's the only sanctioned programmatic-ish channel, and a coalition attorney partner already has standing to subscribe.

**What blocks us from a cleaner answer:** AOC has no public API, doesn't publish a robots.txt declaration we could find, and the KCOJ Terms of Use PDF didn't parse cleanly in this research pass. Before any scraping goes live we need a human read of `https://kcoj.kycourts.net/Content/docs/TermsOfUse2-4-13.pdf` and ideally a written "we plan to do X, is that OK?" email to `OpenRecords@kycourts.net`. That's a one-day task, not a blocker for spike work.

---

## Access mechanism inventory

### 1. KCOJ guest docket portal (public web, no login) — **primary**

- **What it is:** `https://kcoj.kycourts.net/dockets/` lets anyone (no account) generate a docket filtered by County → Division (District) → Date → Courtroom. Daviess District Court forcible-detainer hearings appear here. ([KCOJ Docket](https://kcoj.kycourts.net/dockets/))
- **Cost:** $0 setup, $0 ongoing.
- **Latency to first data:** ~1–2 weeks of dev (build scraper, parse docket HTML, normalize defendant/plaintiff/case-number/hearing-date, dedupe, store).
- **Maintenance burden:** Solo-dev tractable. Selector/HTML breakage maybe 1–2x/year based on AOC's historical change cadence. Budget ~4 hrs/quarter.
- **Freshness:** Daily cron is achievable; the docket is publicly described as "near real-time" upstream of the portal. ([CourtNet 2.0 overview, ehelp.kycourts.net](https://ehelp.kycourts.net/courtnetserviceplans/))
- **Legal/TOS posture:** **Yellow.** The portal explicitly invites guest searches of public case info. KY case records are public under the Supreme Court's open-records framework ([KOGC summary](https://kyopengov.org/law/court-records); [AOC Open Records Policy, 2017](https://www.kycourts.gov/Courts/Supreme-Court/Supreme%20Court%20Orders/201709.pdf)). Forcible-detainer filings are public records — there is no PHI gate here. **However**, the KCOJ Terms of Use ([PDF](https://kcoj.kycourts.net/Content/docs/TermsOfUse2-4-13.pdf)) was not legible to this research pass; before scraping at scale a human must read it for any anti-automation, no-bulk-extract, or no-redistribution clauses. The portal also displays a disclaimer ("NOT AN OFFICIAL DOCKET — SUBJECT TO CHANGE") that we'd need to surface to downstream users.
- **Failure modes:** (a) AOC rebuilds the portal — they did this once already in the CourtNet 1.0 → 2.0 migration; (b) Tyler Technologies' new "File & Serve" rollout changes the public-facing surface ([CourtNet/eFiling, KBA](https://kybar.org/For-Members/Courtnet-and-eFiling)); (c) AOC interprets scraping as TOS-violating and sends a cease-and-desist. Mitigation: low request volume (one query per day per county), realistic User-Agent identifying the coalition, contact email in the UA string, throttle aggressively.

### 2. CourtNet 2.0 subscription (paid, attorney-gated) — **enrichment + backstop**

- **What it is:** AOC's official subscription portal for civil/criminal case detail across all 120 counties, ~10,000 attorney subscribers. Six service plans, five paid; cheapest is **$5/mo** with per-image $0.35 charges and per-case overage above plan allotment. Subaccounts $10/mo/user. Specific tier-by-tier case caps are behind a table image we couldn't OCR — call eCourt Support 502-573-2350 x50109 to size correctly. ([CourtNet 2.0 Service Plans](https://ehelp.kycourts.net/courtnetserviceplans/); [CourtNet FAQs](https://ehelp.kycourts.net/courtnet-faqs/))
- **Eligibility:** **KY-licensed attorneys and AOC-eligible media only.** A homelessness nonprofit cannot subscribe in its own name. We need a coalition attorney partner (eviction-defense bar, Legal Aid of Western KY, or a private pro-bono partner) to hold the account and let us operate it under a written agreement. ([KOGC](https://kyopengov.org/law/court-records))
- **Cost:** $5–$50/mo realistic for our volume (Daviess ran ~46 forcible-detainer filings in Feb 2026 per LSC CCDI — small).
- **Latency to first data:** 1–3 weeks (find sponsoring attorney → contracting → account creation).
- **Maintenance:** Low technical burden, moderate relationship burden — the attorney is the legal subscriber and shares responsibility for TOS compliance.
- **Freshness:** Near real-time. ([CourtNet 2.0 overview](https://ehelp.kycourts.net/courtnetserviceplans/))
- **Legal posture:** **Green** for what it's chartered for. **Unknown** whether automated access is sanctioned — no public API is documented and the FAQ doesn't address scraping the authenticated portal. Default assumption: manual or lightly-scripted use under the attorney account is fine; high-volume programmatic extraction is not. Confirm with eCourt Support before automating.
- **Failure modes:** AOC tightens eligibility (rare); attorney partner exits the coalition; AOC bans automation against the authenticated portal.

### 3. Kentucky eFiling system

- KY eFiling is the *submission* side (lawyers filing documents into cases), not a public read API. Tyler Technologies is rolling out a "File & Serve" replacement now. ([CourtNet/eFiling, KBA](https://kybar.org/For-Members/Courtnet-and-eFiling)) **Not a data source for us.** Worth re-checking in 12 months in case the new platform exposes any public read endpoints.

### 4. PACER-equivalent for KY state courts

- **None exists.** PACER is federal. KY state courts have CourtNet (subscription) and the KCOJ guest portal (public web). No bulk-data feed, no RSS, no documented API. ([KOGC](https://kyopengov.org/law/court-records))

### 5. Third-party aggregators (UniCourt, Trellis, Docket Alarm, CourtListener)

- **CourtListener / RECAP** (Free Law Project) — federal-court focused. State-court coverage exists but is uneven; **no confirmed Kentucky District Court forcible-detainer coverage**. Pricing is means-based. ([CourtListener APIs](https://www.courtlistener.com/help/api/); [REST API v4.3](https://www.courtlistener.com/help/api/rest/)) Worth a 30-min spike to query their KY collection, but don't plan around it.
- **UniCourt** — markets KY state-court search but coverage is shallow at the District Court forcible-detainer level; pricing is enterprise (typically four figures/mo for API, not published). ([UniCourt KY](https://unicourt.com/courts/state-kentucky)) Not viable for solo-dev/low-budget.
- **Trellis, Docket Alarm** — neither surfaced in KY-specific searches with usable Daviess District coverage. Both are enterprise-priced. **Dead end for Phase 1.**
- **LexisNexis Risk Solutions / American Information Research Services** — these are who Eviction Lab buys from. Six-figure contracts. ([Eviction Lab Methods](https://evictionlab.org/methods/)) Not for us.

### 6. Legal Services Corporation Civil Court Data Initiative — **baseline only**

- **What it is:** LSC tracks all 120 KY counties for forcible-detainer filings; **Daviess is covered**, showing 46 filings in Feb 2026. ([Daviess data page](https://civilcourtdata.lsc.gov/data/eviction/kentucky/daviess/); [KY landing](https://civilcourtdata.lsc.gov/data/eviction/kentucky/))
- **Granularity:** Public dashboard is **county-level monthly aggregates only**. CSV export is at the same aggregate level. Case-level data (defendant name, address, case number — i.e. what we actually need to do outreach) is gated behind a **data-sharing agreement with LSC** (`civilcourtdata@lsc.gov`). LSC commonly signs these with academic researchers and federal agencies. ([CCDI FAQ](https://civilcourtdata.lsc.gov/about/faq/))
- **Cost:** $0 for aggregates. Unknown for case-level access.
- **Latency:** Months — institutional contracting, not a Phase-1 path. Worth pursuing in parallel as a Phase-2 unlock and as evidence/sanity-check for our own scraper counts.
- **Failure mode:** LSC declines the agreement because we're not a federally-funded grantee.

### 7. KY Open Records Act (KRS 61.870–884) for bulk case data

- **Will not work.** AOC's Open Records Policy explicitly excludes "court case records or compiled information" from what AOC must produce under the open-records framework — it covers only AOC *administrative* records (budgets, contracts, etc.). Bulk eviction-data requests will be refused, and KY agencies have no obligation to compile data on request. ([AOC Open Records Policy, 2017](https://www.kycourts.gov/Courts/Supreme-Court/Supreme%20Court%20Orders/201709.pdf); [KOGC](https://kyopengov.org/law/court-records)) The recourse for case data is the public docket portal or CourtNet — i.e. options 1 and 2.

### 8. Existing civic-tech / legal-aid precedent in KY

- Kentucky Justice Online (`kyjustice.org`) and Kentucky Equal Justice Center publish *guidance* on eviction defense but no published data pipeline. ([KEJC](https://www.kyequaljustice.org/); [KY Justice Online Evictions](https://www.kyjustice.org/topics/housing/evictions))
- AppalReD Legal Aid (Eastern KY) and Legal Aid of the Bluegrass have advocated on eviction policy but we found no public scraper repo or data partnership we could plug into. ([AppalReD](https://www.ardfky.org/page/451/amid-housing-crisis-advocates-push-tenants-rights))
- **Eviction Lab** (Princeton) covers KY's urban centers well, rural less so, via a mix of scraping and purchased LexisNexis data. Their data is published as aggregates; case-level is not redistributed. ([Eviction Lab Methods](https://evictionlab.org/methods/))
- **Closest open-source analogue:** Searchlight New Mexico's eviction scraper repo — different state, but a useful pattern reference. ([searchlight NM repo](https://github.com/searchlightdata/New-Mexico-evictions-database))
- **No KY coalition has solved this publicly.** That's both an opportunity (we'd be first) and a small warning (nobody's done it because it's annoying, not because there's a magic shortcut we're missing).

---

## What I marked unknown

- Exact CourtNet 2.0 tier table — pricing image didn't OCR; need a phone call to eCourt Support.
- KCOJ Terms of Use specifics on automation/scraping — PDF didn't parse; needs a human read.
- Whether AOC will respond constructively to a written "we intend to do X" notification — unknown until tried.
- LSC CCDI's appetite for a case-level data-sharing agreement with a county-level coalition (vs. their typical academic/federal partners) — unknown until asked.
- CourtListener's actual KY District Court coverage — unverified; cheap to spike.

---

## Suggested next actions

1. **Spike (1 day):** human-read the KCOJ Terms of Use PDF; pull the docket page for Daviess District tomorrow morning and inspect the HTML structure; write a one-page assessment.
2. **Spike (½ day):** call eCourt Support, get the tier table, and ask explicitly whether scripted access from an attorney account is permitted.
3. **Outreach (parallel, low-priority):** email `civilcourtdata@lsc.gov` introducing the coalition and asking about case-level data-sharing terms. Worst case: free baseline numbers we can audit our scraper against.
4. **Sequencing:** if the spike clears the legal posture, build the scraper as the first EVDT story. Treat a sponsoring-attorney CourtNet account as a Phase-1.5 enrichment, not a blocker.
