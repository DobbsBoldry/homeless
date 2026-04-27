import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '@/db/client';
import { type ClientDocument, clientDocuments } from '@/db/schema/client-documents';
import { type ClientIntake, clientIntakes } from '@/db/schema/client-intakes';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { type PartnerServiceEvent, partnerServiceEvents } from '@/db/schema/partner-service-events';
import {
  type PersonPartnerConsent,
  personPartnerConsents,
} from '@/db/schema/person-partner-consents';

export type PersonServiceEvent = PartnerServiceEvent & { partnerOrgName: string };
export type PersonConsentRow = PersonPartnerConsent & { partnerOrgName: string };

export type PersonProfile = {
  syntheticPersonRef: string;
  serviceEvents: PersonServiceEvent[];
  consents: PersonConsentRow[];
  intakes: ClientIntake[];
  documents: ClientDocument[];
};

/**
 * Pull every coalition-side artifact tied to a synthetic_person_ref.
 * Phase-1 scope: service events, person/partner consents, voice
 * intakes, and uploaded documents. Eviction filings, ED encounters,
 * and care plans aren't keyed on synthetic_person_ref yet (they use
 * defendant name + DOB / patient hash) — they join in post-data-trust
 * (DTRS-014).
 */
export async function getPersonProfile(syntheticPersonRef: string): Promise<PersonProfile> {
  const eventsRows = await db
    .select({
      event: partnerServiceEvents,
      partnerOrgName: partnerOrgs.name,
    })
    .from(partnerServiceEvents)
    .innerJoin(partnerOrgs, eq(partnerOrgs.id, partnerServiceEvents.partnerOrgId))
    .where(eq(partnerServiceEvents.syntheticPersonRef, syntheticPersonRef))
    .orderBy(desc(partnerServiceEvents.eventAt));

  const consentRows = await db
    .select({
      consent: personPartnerConsents,
      partnerOrgName: partnerOrgs.name,
    })
    .from(personPartnerConsents)
    .innerJoin(partnerOrgs, eq(partnerOrgs.id, personPartnerConsents.partnerOrgId))
    .where(eq(personPartnerConsents.syntheticPersonRef, syntheticPersonRef))
    .orderBy(desc(personPartnerConsents.grantedAt));

  const intakes = await db
    .select()
    .from(clientIntakes)
    .where(eq(clientIntakes.syntheticPersonRef, syntheticPersonRef))
    .orderBy(desc(clientIntakes.createdAt));

  const documents = await db
    .select()
    .from(clientDocuments)
    .where(eq(clientDocuments.syntheticPersonRef, syntheticPersonRef))
    .orderBy(desc(clientDocuments.createdAt));

  return {
    syntheticPersonRef,
    serviceEvents: eventsRows.map((r) => ({ ...r.event, partnerOrgName: r.partnerOrgName })),
    consents: consentRows.map((r) => ({ ...r.consent, partnerOrgName: r.partnerOrgName })),
    intakes,
    documents,
  };
}

/**
 * Subset of the profile filtered to a since-cutoff. Used by the
 * pre-meeting summary so the AI sees only what changed since the
 * last meeting.
 */
export type PersonProfileDelta = {
  syntheticPersonRef: string;
  since: Date;
  serviceEvents: PersonServiceEvent[];
  newConsentGrants: PersonConsentRow[];
  newConsentRevocations: PersonConsentRow[];
  newIntakes: ClientIntake[];
  newDocuments: ClientDocument[];
};

export async function getPersonProfileDelta(
  syntheticPersonRef: string,
  since: Date,
): Promise<PersonProfileDelta> {
  const eventsRows = await db
    .select({ event: partnerServiceEvents, partnerOrgName: partnerOrgs.name })
    .from(partnerServiceEvents)
    .innerJoin(partnerOrgs, eq(partnerOrgs.id, partnerServiceEvents.partnerOrgId))
    .where(
      and(
        eq(partnerServiceEvents.syntheticPersonRef, syntheticPersonRef),
        gte(partnerServiceEvents.eventAt, since),
      ),
    )
    .orderBy(desc(partnerServiceEvents.eventAt));

  const grants = await db
    .select({ consent: personPartnerConsents, partnerOrgName: partnerOrgs.name })
    .from(personPartnerConsents)
    .innerJoin(partnerOrgs, eq(partnerOrgs.id, personPartnerConsents.partnerOrgId))
    .where(
      and(
        eq(personPartnerConsents.syntheticPersonRef, syntheticPersonRef),
        gte(personPartnerConsents.grantedAt, since),
      ),
    )
    .orderBy(desc(personPartnerConsents.grantedAt));

  const revocations = await db
    .select({ consent: personPartnerConsents, partnerOrgName: partnerOrgs.name })
    .from(personPartnerConsents)
    .innerJoin(partnerOrgs, eq(partnerOrgs.id, personPartnerConsents.partnerOrgId))
    .where(
      and(
        eq(personPartnerConsents.syntheticPersonRef, syntheticPersonRef),
        gte(personPartnerConsents.revokedAt, since),
      ),
    )
    .orderBy(desc(personPartnerConsents.revokedAt));

  const intakes = await db
    .select()
    .from(clientIntakes)
    .where(
      and(
        eq(clientIntakes.syntheticPersonRef, syntheticPersonRef),
        gte(clientIntakes.createdAt, since),
      ),
    )
    .orderBy(desc(clientIntakes.createdAt));

  const documents = await db
    .select()
    .from(clientDocuments)
    .where(
      and(
        eq(clientDocuments.syntheticPersonRef, syntheticPersonRef),
        gte(clientDocuments.createdAt, since),
      ),
    )
    .orderBy(desc(clientDocuments.createdAt));

  return {
    syntheticPersonRef,
    since,
    serviceEvents: eventsRows.map((r) => ({ ...r.event, partnerOrgName: r.partnerOrgName })),
    newConsentGrants: grants.map((r) => ({ ...r.consent, partnerOrgName: r.partnerOrgName })),
    newConsentRevocations: revocations.map((r) => ({
      ...r.consent,
      partnerOrgName: r.partnerOrgName,
    })),
    newIntakes: intakes,
    newDocuments: documents,
  };
}
