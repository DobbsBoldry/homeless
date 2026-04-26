import type { UserRole } from '@/db/schema/enums';

/** Roles allowed to view the filings dashboard. Mirrors the sidebar nav config. */
export const CaseFilingsRoles: readonly UserRole[] = ['attorney', 'caseworker', 'admin'];
