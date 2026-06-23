/**
 * INDC-019: pure helpers for rendering person/partner consent history.
 *
 * The raw event log (`person_partner_consent_events`) stores only
 * `'granted' | 'revoked'`. The human-facing timeline distinguishes the first
 * grant ("Granted") from later ones ("Re-granted"), so this derivation is a
 * small pure function — unit-tested without a DB, the same way the rest of the
 * dtrs domain factors its testable logic out of the query/action layer.
 */

export type ConsentEventType = 'granted' | 'revoked';

export interface ConsentEventInput {
  eventType: ConsentEventType;
  eventAt: Date;
}

export type ConsentEventLabel = 'Granted' | 'Re-granted' | 'Revoked';

export interface LabeledConsentEvent {
  eventType: ConsentEventType;
  eventAt: Date;
  label: ConsentEventLabel;
}

/**
 * Order events oldest→newest and label each: the first `granted` is "Granted",
 * any subsequent `granted` is "Re-granted", every `revoked` is "Revoked".
 * Input is not mutated; ties broken stably by original order.
 */
export function labelConsentEvents(events: readonly ConsentEventInput[]): LabeledConsentEvent[] {
  const ordered = events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.eventAt.getTime() - b.e.eventAt.getTime() || a.i - b.i)
    .map(({ e }) => e);

  let grantSeen = false;
  return ordered.map((e) => {
    if (e.eventType === 'revoked') {
      return { eventType: e.eventType, eventAt: e.eventAt, label: 'Revoked' as const };
    }
    const label: ConsentEventLabel = grantSeen ? 'Re-granted' : 'Granted';
    grantSeen = true;
    return { eventType: e.eventType, eventAt: e.eventAt, label };
  });
}
