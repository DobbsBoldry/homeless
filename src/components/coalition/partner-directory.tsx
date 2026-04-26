import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DataSharingTier, PartnerOrgType } from '@/db/schema/enums';
import type { PartnerOrg } from '@/db/schema/partner-orgs';

const TYPE_LABEL: Record<PartnerOrgType, string> = {
  hospital: 'Healthcare',
  legal_aid: 'Legal aid',
  shelter: 'Shelter providers',
  community_org: 'Community organizations',
  government: 'Government',
  faith_based: 'Faith-based',
  school: 'Schools',
  philanthropy: 'Philanthropy',
  education: 'Higher education',
  public_health: 'Public health',
  media: 'Media',
  other: 'Other',
};

const TIER_LABEL: Record<DataSharingTier, string> = {
  none: 'No data flow yet',
  aggregate: 'Aggregate counts',
  individual: 'Individual (consented)',
};

// Color signals data-sensitivity, not workflow-success. `individual`
// is the most-sensitive tier (consent-gated PHI flow); it gets the
// most-intense badge so a directory reviewer's eye lands there.
// `aggregate` is anonymized public-ish counts; muted info-color.
// `none` is the default "no agreement yet" state; quiet grey.
const TIER_BADGE: Record<DataSharingTier, string> = {
  none: 'bg-muted text-muted-foreground',
  aggregate: 'bg-secondary text-secondary-foreground',
  individual: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
};

export function PartnerDirectory({ orgs }: { orgs: PartnerOrg[] }) {
  // Group by type, preserving alphabetical order within each group.
  const grouped = orgs.reduce<Map<PartnerOrgType, PartnerOrg[]>>((acc, org) => {
    const list = acc.get(org.type) ?? [];
    list.push(org);
    acc.set(org.type, list);
    return acc;
  }, new Map());

  return (
    <div className="space-y-4">
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">Phase-1 placeholder.</p>
          <p className="mt-1 text-muted-foreground">
            This directory lists every coalition stakeholder catalogued in the Daviess Pilot Report.
            Data-sharing tiers default to "none" — they raise to "aggregate" or "individual" only
            after a signed coalition data-trust agreement (see{' '}
            <code className="font-mono">docs/research/Daviess_County_Pilot_Report.md</code> §5).
            Contact info is intentionally minimal: names + websites are public; phone numbers and
            emails are added per partner conversation, not seeded.
          </p>
        </CardContent>
      </Card>

      {Array.from(grouped.entries()).map(([type, list]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle className="text-base">
              {TYPE_LABEL[type]}{' '}
              <span className="text-xs font-normal text-muted-foreground">({list.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {list.map((org) => (
                <li key={org.id} className="rounded-md border border-border bg-card p-3">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{org.name}</p>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${TIER_BADGE[org.dataSharingTier]}`}
                      title="Phase-1 data-sharing tier"
                    >
                      {TIER_LABEL[org.dataSharingTier]}
                    </span>
                  </div>
                  {org.description ? (
                    <p className="text-sm text-muted-foreground">{org.description}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-3 text-xs">
                    {org.website ? (
                      <a
                        href={org.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="hover:underline"
                      >
                        website ↗
                      </a>
                    ) : null}
                    {org.contactPhone ? (
                      <a className="font-mono hover:underline" href={`tel:${org.contactPhone}`}>
                        {org.contactPhone}
                      </a>
                    ) : null}
                    {org.contactEmail ? (
                      <a className="hover:underline" href={`mailto:${org.contactEmail}`}>
                        {org.contactEmail}
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
