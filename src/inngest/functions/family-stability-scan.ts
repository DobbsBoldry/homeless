/**
 * SUBP-007 — nightly school-stability scan.
 *
 * Iterates active family_units, computes school-stability risk via the
 * pure scoring engine, and surfaces high/critical-tier families to
 * Sentry for ops visibility. Caseworker-facing notification piping
 * (email / dashboard) is a follow-up.
 *
 * The scan is read-only — no mutations. Idempotent: re-running surfaces
 * the same families until their housing or school-stability inputs
 * change.
 *
 * Cron: 0 8 * * * (08:00 UTC daily, 03:00 Central — runs after the
 * agreement-expiration-watcher).
 */
import * as Sentry from '@sentry/nextjs';
import { listActiveFamiliesForStabilityScan, listChildrenForFamily } from '@/db/queries/families';
import { computeSchoolStabilityRisk } from '@/lib/subp';
import { inngest } from '../client';

interface ScanSummary {
  scanned: number;
  flaggedHigh: number;
  flaggedCritical: number;
}

export const familyStabilityScan = inngest.createFunction(
  {
    id: 'family-stability-scan',
    retries: 2,
    triggers: [{ cron: '0 8 * * *' }],
  },
  async ({ step }) => {
    const summary: ScanSummary = { scanned: 0, flaggedHigh: 0, flaggedCritical: 0 };

    const families = await step.run('list-active-families', async () =>
      listActiveFamiliesForStabilityScan(),
    );
    summary.scanned = families.length;

    for (const family of families) {
      const children = await listChildrenForFamily(family.id);
      const anyMv = children.some((c) => c.enrolledInMckinneyVento.flagged);
      const changedChild = children.find(
        (c) =>
          c.currentSchoolId !== null &&
          family.receivingSchoolDistrictId !== null &&
          c.currentSchoolId !== family.receivingSchoolDistrictId,
      );
      const risk = computeSchoolStabilityRisk({
        childrenCount: family.childrenCount,
        housingStatus: family.currentHousingStatus,
        schoolOfOriginId: family.receivingSchoolDistrictId,
        currentSchoolId: changedChild?.currentSchoolId ?? family.receivingSchoolDistrictId,
        midSchoolYear: true,
        anyChildMckinneyVentoEnrolled: anyMv,
      });

      if (risk.risk === 'critical') {
        summary.flaggedCritical += 1;
        Sentry.captureMessage('[family-stability-scan] critical risk', {
          level: 'error',
          tags: { source: 'family-stability-scan', risk: 'critical' },
          extra: {
            familyId: family.id,
            housingStatus: family.currentHousingStatus,
            childrenCount: family.childrenCount,
            reasons: risk.reasons,
          },
        });
      } else if (risk.risk === 'high') {
        summary.flaggedHigh += 1;
        Sentry.captureMessage('[family-stability-scan] high risk', {
          level: 'warning',
          tags: { source: 'family-stability-scan', risk: 'high' },
          extra: {
            familyId: family.id,
            housingStatus: family.currentHousingStatus,
            childrenCount: family.childrenCount,
            reasons: risk.reasons,
          },
        });
      }
    }

    return summary;
  },
);
