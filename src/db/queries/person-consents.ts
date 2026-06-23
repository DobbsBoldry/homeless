import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { partnerServiceEvents } from '@/db/schema/partner-service-events';
import { personPartnerConsentEvents } from '@/db/schema/person-partner-consent-events';
import { personPartnerConsents } from '@/db/schema/person-partner-consents';
import { type LabeledConsentEvent, labelConsentEvents } from '@/lib/dtrs';

export interface PersonPartnerSummary {
  partnerOrgId: string;
  partnerName: string;
  consentId: string | null;
  grantedAt: Date | null;
  revokedAt: Date | null;
  eventCount: number;
  latestEventAt: Date | null;
  latestEventType: string | null;
  /** Append-only grant/revoke history (INDC-019), oldest→newest, labeled. */
  consentEvents: LabeledConsentEvent[];
}

/**
 * Per-partner summary for a synthetic person — what consent state is on
 * record + how many service events the partner has logged for them.
 *
 * Joins consent + events so a person can see "Boulware: 3 events on
 * file, consent granted [date]" or "Catholic Charities: 1 event on
 * file, consent revoked [date]." Partners with NO events but an
 * explicit grant still appear; partners with events but NO consent
 * row also appear (the row is created on first revoke or via seed).
 */
export async function listPersonPartnerSummary(
  syntheticPersonRef: string,
): Promise<PersonPartnerSummary[]> {
  const consents = await db
    .select({
      id: personPartnerConsents.id,
      partnerOrgId: personPartnerConsents.partnerOrgId,
      partnerName: partnerOrgs.name,
      grantedAt: personPartnerConsents.grantedAt,
      revokedAt: personPartnerConsents.revokedAt,
    })
    .from(personPartnerConsents)
    .innerJoin(partnerOrgs, eq(partnerOrgs.id, personPartnerConsents.partnerOrgId))
    .where(eq(personPartnerConsents.syntheticPersonRef, syntheticPersonRef))
    .orderBy(asc(partnerOrgs.name));

  const events = await db
    .select({
      partnerOrgId: partnerServiceEvents.partnerOrgId,
      eventType: partnerServiceEvents.eventType,
      eventAt: partnerServiceEvents.eventAt,
    })
    .from(partnerServiceEvents)
    .where(eq(partnerServiceEvents.syntheticPersonRef, syntheticPersonRef))
    .orderBy(desc(partnerServiceEvents.eventAt));

  const eventByPartner = new Map<string, { count: number; latestAt: Date; latestType: string }>();
  for (const e of events) {
    const prev = eventByPartner.get(e.partnerOrgId);
    if (!prev) {
      eventByPartner.set(e.partnerOrgId, {
        count: 1,
        latestAt: e.eventAt,
        latestType: e.eventType,
      });
    } else {
      prev.count += 1;
    }
  }

  // Consent grant/revoke history per parent row (INDC-019).
  const consentIds = consents.map((c) => c.id);
  const consentEventRows = consentIds.length
    ? await db
        .select({
          consentId: personPartnerConsentEvents.consentId,
          eventType: personPartnerConsentEvents.eventType,
          eventAt: personPartnerConsentEvents.eventAt,
        })
        .from(personPartnerConsentEvents)
        .where(inArray(personPartnerConsentEvents.consentId, consentIds))
    : [];
  const eventsByConsent = new Map<string, { eventType: 'granted' | 'revoked'; eventAt: Date }[]>();
  for (const e of consentEventRows) {
    const list = eventsByConsent.get(e.consentId) ?? [];
    list.push({ eventType: e.eventType, eventAt: e.eventAt });
    eventsByConsent.set(e.consentId, list);
  }

  return consents.map((c) => {
    const ev = eventByPartner.get(c.partnerOrgId);
    return {
      partnerOrgId: c.partnerOrgId,
      partnerName: c.partnerName,
      consentId: c.id,
      grantedAt: c.grantedAt,
      revokedAt: c.revokedAt,
      eventCount: ev?.count ?? 0,
      latestEventAt: ev?.latestAt ?? null,
      latestEventType: ev?.latestType ?? null,
      consentEvents: labelConsentEvents(eventsByConsent.get(c.id) ?? []),
    };
  });
}
