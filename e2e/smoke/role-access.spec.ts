/**
 * S4 — Role-based access matrix.
 *
 * Each persona can reach a representative permitted route, and is 404'd
 * from a representative forbidden route. The handler 404s rather than 403s
 * to avoid leaking which routes exist for which roles (see docs/access-control.md).
 */
import { expect, type Persona, test } from '../fixtures/test-base';

interface PermittedCase {
  persona: Persona;
  path: string;
}

interface ForbiddenCase {
  persona: Persona;
  path: string;
}

const PERMITTED: PermittedCase[] = [
  { persona: 'attorney', path: '/app/cases/triage' }, // requireKlaAttorney
  { persona: 'caseworker', path: '/app/clients/triage' },
  { persona: 'coordinator', path: '/app/care/triage' },
  { persona: 'shelter', path: '/app/clients/triage' }, // shelter_staff allowed here
  { persona: 'admin', path: '/app/admin/users' },
];

const FORBIDDEN: ForbiddenCase[] = [
  { persona: 'attorney', path: '/app/admin/users' },
  { persona: 'caseworker', path: '/app/admin/users' },
  { persona: 'coordinator', path: '/app/admin/users' },
  { persona: 'shelter', path: '/app/admin/users' },
  { persona: 'caseworker', path: '/app/cases/triage' }, // KLA-only
  { persona: 'coordinator', path: '/app/cases/triage' },
];

test.describe('S4 role-based access', () => {
  for (const { persona, path } of PERMITTED) {
    test(`S4 permitted: ${persona} -> ${path}`, async ({ page, signInAs }) => {
      await signInAs(persona);
      const resp = await page.goto(path);
      expect(resp?.status() ?? 0, `${persona} blocked from ${path}`).toBeLessThan(400);
    });
  }

  for (const { persona, path } of FORBIDDEN) {
    test(`S4 forbidden: ${persona} -> ${path}`, async ({ page, signInAs }) => {
      await signInAs(persona);
      const resp = await page.goto(path);
      // requireRole/requireKlaAttorney call notFound() which renders 404.
      expect(resp?.status() ?? 0, `${persona} reached ${path} when it should 404`).toBe(404);
    });
  }
});
