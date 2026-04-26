# Daviess District Court Clerk's Office — Outreach Playbook

**Story:** EVDT-002. **Owner of the call:** Bo. **Time required:** ~10 minutes.

This is a backup / parallel path to EVDT-001 (KY CourtNet). Even if the
KCOJ scraper lands and works, having a direct relationship with the
Daviess District Court Clerk's office gives us:

1. A human escalation path when the scraper breaks at 6am
2. A way to access sealed-but-served records that don't show on the public docket
3. A potential daily manual export (fax/email/CSV) as a Phase-0 redundant feed
4. Goodwill — KLA, our legal-aid partner, will need this relationship anyway

## Who to call

**Daviess District Court Clerk's Office**
Susan Tipmore — Circuit Court Clerk (also handles District Court records)
Address: 100 East 2nd Street, Owensboro, KY 42303
Phone: **(270) 687-7327**
Web: https://daviesscircuitcourtclerk.com/

> Note: The Circuit Court Clerk in KY counties is the records keeper for
> BOTH Circuit and District Court (forcible-detainer / eviction filings
> live in District Court). One office, one call.

## When to call

- **Best window:** Tuesday–Thursday, 9:00–11:00 AM Central
- **Avoid:** Mondays (busiest), end-of-month (filings deadline rush), 1st of the month (rent-due eviction surge)
- **Phone is far more likely to land than email** for first contact

## Who to ask for

> "Hi, I'm calling about access to the daily forcible-detainer docket. May
> I speak with whoever handles records requests, or your records clerk?"

If routed to voicemail, say:
> "My name is Bo Thompson, I'm with a Daviess County homelessness coalition
> partnering with Kentucky Legal Aid. We're building a tool to help with
> tenant outreach before court dates. I'd like to ask 5 short questions
> about the daily docket. Best callback number is `<your number>`."

## The 5 questions to get answered

Lead with intent and end with the ask — clerks are busy, don't bury the lede.

> "Quick context: we're building a coalition tool to flag eviction
> filings and offer tenants legal help **before** their first court date.
> KLA is on the legal side. The tool needs the daily list of forcible-
> detainer filings — defendant name, plaintiff, case number, court date.
> All public-record stuff. Five quick questions:"

1. **Daily availability.** Does your office produce a daily forcible-detainer docket — printed, emailed, or otherwise? When is it generated each day?
2. **Format.** What format is it in? (PDF? Word? CSV? On the public-terminal screen only?)
3. **Sharing.** Is there a way for me to receive that docket every business day — a standing email, a pickup, a fax, or a portal login?
4. **Fee.** Is there a fee for ongoing access? (Open Records Act allows reasonable copy fees but typically waives for media/research/non-commercial public-interest use.)
5. **Contact.** Who's the right ongoing point of contact for this kind of arrangement, and what's the best way to reach them?

If they offer a meeting in person, take it — drive to Owensboro, sit down,
shake hands. The relationship matters more than the data feed.

## Email follow-up template

Send the same day, within 1 hour of the call. Keep it short.

> Subject: Following up — Daviess District Court daily forcible-detainer docket
>
> Hi `<name>`,
>
> Thanks for taking my call this morning. I appreciated the conversation.
>
> Recapping what we discussed:
>
> - We're building a coalition tool with Kentucky Legal Aid to help
>   tenants get representation before their first court date in
>   forcible-detainer cases.
> - I asked about access to the daily docket. Here's what I heard:
>     - Daily docket is `<format>`, generated `<when>`.
>     - Sharing options you mentioned: `<options>`.
>     - Fee structure: `<fee>`.
>     - Best ongoing contact: `<name + email/phone>`.
>
> If I have any of that wrong, please correct me. Otherwise, my next step
> is to `<concrete next step from the call>`. If a written records request
> is needed, I can send one — just let me know the form.
>
> Grateful for your time. The coalition partners (KLA, Audubon Area
> Community Services, Owensboro Health) are all working on different
> pieces of this; the daily docket is the hinge.
>
> Best,
> Bo Thompson
> `<phone>` | `<email>`

## After the call

Capture answers in `docs/research/daviess-clerk-outreach-result.md`
(template stub committed alongside this file). Even a "no" is a result —
write down what they said and why, so we don't lose the context.

If the answer is yes-but-needs-paperwork, file an Open Records Act request
(KRS 61.870–884). The court itself is exempt from ORA but the **clerk's
office records of public filings** are generally honored under common-law
public-records access. The KY Open Government Coalition has templates:
https://kyopengov.org/

## Fallback paths if this call goes nowhere

In rough preference order:

1. **Try Audubon Area Community Services or KLA Owensboro** — they
   already have the relationship; ask if they'll forward a daily docket
   email they already receive.
2. **In-person visit to the courthouse public terminal** — the docket is
   public. Worst case: someone drives to Owensboro daily and snaps photos.
   Not scalable but proves the concept.
3. **Lean on the EVDT-001 KCOJ scraper** — that's the primary path
   anyway; the clerk relationship was always the safety net.

## Definition of done

- [x] Playbook committed at this path
- [ ] Bo makes the call (target: within 1 week)
- [ ] Answers captured in `daviess-clerk-outreach-result.md`
- [ ] If yes-with-paperwork: ORA letter sent
- [ ] If no: failure mode documented, fallback path picked
