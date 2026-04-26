/**
 * Banner shown to users whose role is `pending` (default for new signups).
 * Tells them their account needs admin approval before they can see the
 * role-gated surfaces (Filings, Clients, etc.). Non-PHI surfaces (Dashboard,
 * Settings) remain accessible.
 */
export function PendingBanner() {
  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <strong className="font-semibold">Account pending.</strong> Your account is awaiting admin
      approval. You'll get access to Filings, Cases, and Clients once an admin assigns you a role.
    </div>
  );
}
