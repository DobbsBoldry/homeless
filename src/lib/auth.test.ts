import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '@/db/schema/enums';

/**
 * #222 / FND auth-gate tests.
 *
 * The contract:
 *   - requireRole returns the user when role ∈ allow-list, calls
 *     notFound() otherwise (don't leak which routes exist for which roles)
 *   - requireKlaAttorney returns the user only when role === 'attorney' AND
 *     they have an org_membership pointing at partner_orgs.slug = 'kla-owensboro';
 *     any other combination 404s
 *
 * Mocks: stub `@clerk/nextjs/server`, `@/db/client`, `next/navigation`, and
 * `@/lib/audit` — the auth-gate behavior under test is pure logic over user
 * role + KLA membership, so we feed those through a per-test queue and
 * assert what comes out.
 */

const dbSelectQueue: unknown[][] = [];

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/db/client', () => {
  // Drizzle's query builder is a lazy chain whose terminal in auth.ts is
  // always `.limit(...)`. Make `limit` return the next queued result;
  // every other chain method just hands back another chain.
  const makeChain = (): Record<string, unknown> => ({
    from: () => makeChain(),
    where: () => makeChain(),
    innerJoin: () => makeChain(),
    limit: () => Promise.resolve(dbSelectQueue.shift() ?? []),
  });
  return {
    db: {
      select: () => makeChain(),
    },
  };
});

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

const { requireRole, requireKlaAttorney, userIsKlaAttorney } = await import('./auth');
const { auth } = await import('@clerk/nextjs/server');

const fakeUser = (role: UserRole, overrides: Record<string, unknown> = {}) => ({
  id: 'user-uuid-1',
  clerkUserId: 'clerk_test',
  email: 'test@example.com',
  firstName: null,
  lastName: null,
  role,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  dbSelectQueue.length = 0;
  vi.mocked(auth).mockResolvedValue({ userId: 'clerk_test' } as Awaited<ReturnType<typeof auth>>);
});

describe('requireRole', () => {
  it('returns the user when their role is in the allow-list', async () => {
    dbSelectQueue.push([fakeUser('attorney')]);
    const user = await requireRole(['attorney', 'admin']);
    expect(user.role).toBe('attorney');
  });

  it('returns the user for a single-role allow-list match', async () => {
    dbSelectQueue.push([fakeUser('caseworker')]);
    const user = await requireRole(['caseworker']);
    expect(user.role).toBe('caseworker');
  });

  it('calls notFound() when role is NOT in the allow-list', async () => {
    dbSelectQueue.push([fakeUser('caseworker')]);
    await expect(requireRole(['attorney'])).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('rejects pending users from any role-gated surface', async () => {
    // 'pending' is the default until an admin promotes — it should never
    // satisfy a role gate, even an empty-defaulting one.
    dbSelectQueue.push([fakeUser('pending')]);
    await expect(requireRole(['attorney', 'caseworker', 'admin'])).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });
});

describe('requireKlaAttorney', () => {
  it('returns the user when they are an attorney AND have KLA membership', async () => {
    dbSelectQueue.push([fakeUser('attorney')]); // requireUser SELECT
    dbSelectQueue.push([{ id: 'membership-uuid-1' }]); // KLA membership SELECT
    const user = await requireKlaAttorney();
    expect(user.role).toBe('attorney');
  });

  it('404s a non-attorney even if they have KLA membership', async () => {
    dbSelectQueue.push([fakeUser('caseworker')]); // requireUser SELECT
    // Membership query never runs — short-circuited by the role check.
    await expect(requireKlaAttorney()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('404s an attorney WITHOUT KLA membership', async () => {
    dbSelectQueue.push([fakeUser('attorney')]); // requireUser SELECT
    dbSelectQueue.push([]); // membership query → empty
    await expect(requireKlaAttorney()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('404s an admin even if they have KLA membership', async () => {
    // Sanity: only role === 'attorney' qualifies, not admins or caseworkers.
    dbSelectQueue.push([fakeUser('admin')]);
    await expect(requireKlaAttorney()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('userIsKlaAttorney (non-throwing variant)', () => {
  it('returns true for attorney WITH KLA membership', async () => {
    dbSelectQueue.push([{ id: 'membership-uuid-1' }]);
    expect(await userIsKlaAttorney(fakeUser('attorney'))).toBe(true);
  });

  it('returns false for non-attorney without consulting the DB', async () => {
    // Don't queue any DB result — if the function tries to SELECT, the
    // mock returns [] and we'd still get false, but the test would be
    // ambiguous. Push a sentinel that would *succeed* if consulted, so a
    // false return proves the role short-circuit fired first.
    dbSelectQueue.push([{ id: 'should-not-be-consulted' }]);
    expect(await userIsKlaAttorney(fakeUser('caseworker'))).toBe(false);
    expect(dbSelectQueue.length).toBe(1); // still queued — nothing consumed it
  });

  it('returns false for attorney WITHOUT KLA membership', async () => {
    dbSelectQueue.push([]);
    expect(await userIsKlaAttorney(fakeUser('attorney'))).toBe(false);
  });
});
