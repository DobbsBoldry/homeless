import type { IntakeProfile } from '@/ai/prompts/intake-extraction';

const URGENCY_BADGE: Record<NonNullable<IntakeProfile['urgency']>, string> = {
  today: 'bg-destructive/15 text-destructive',
  within_7_days: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  within_30_days: 'bg-secondary text-secondary-foreground',
  not_urgent: 'bg-muted text-muted-foreground',
};

const URGENCY_LABEL: Record<NonNullable<IntakeProfile['urgency']>, string> = {
  today: 'Today',
  within_7_days: 'Within 7 days',
  within_30_days: 'Within 30 days',
  not_urgent: 'Not urgent',
};

const DOC_LABEL: Record<NonNullable<IntakeProfile['documents_in_hand']>[number], string> = {
  photo_id: 'Photo ID',
  ssn_card: 'SSN card',
  birth_certificate: 'Birth cert',
  dd_214: 'DD-214',
};

const FLAG_LABEL: Record<keyof IntakeProfile['flags'], string> = {
  dv_concern: 'DV concern',
  sud_engaged: 'SUD treatment engaged',
  mental_health_engaged: 'MH treatment engaged',
  has_caseworker_relationship: 'Existing caseworker',
};

const Field = ({ label, value }: { label: string; value: React.ReactNode | null | undefined }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm">
      {value === null || value === undefined || value === '' ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        value
      )}
    </p>
  </div>
);

export function IntakeProfileDisplay({ profile }: { profile: IntakeProfile }) {
  const flags = (Object.keys(profile.flags) as Array<keyof IntakeProfile['flags']>).filter(
    (k) => profile.flags[k],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Client first name" value={profile.client_first_name} />
        <Field
          label="Urgency"
          value={
            profile.urgency ? (
              <span className={`rounded px-2 py-0.5 text-xs ${URGENCY_BADGE[profile.urgency]}`}>
                {URGENCY_LABEL[profile.urgency]}
              </span>
            ) : null
          }
        />
        <Field
          label="Household"
          value={
            profile.household_size != null
              ? `${profile.household_size} ${profile.household_size === 1 ? 'person' : 'people'}${
                  profile.has_children_under_18 && profile.num_children
                    ? ` · ${profile.num_children} child${profile.num_children === 1 ? '' : 'ren'}`
                    : ''
                }`
              : null
          }
        />
        <Field
          label="Documents in hand"
          value={
            profile.documents_in_hand?.length
              ? profile.documents_in_hand.map((d) => DOC_LABEL[d]).join(', ')
              : profile.documents_in_hand !== null
                ? 'None'
                : null
          }
        />
      </div>

      <Field label="Presenting issue" value={profile.presenting_issue} />
      <Field label="Housing status" value={profile.housing_status} />
      <Field label="Income" value={profile.income_summary} />
      <Field
        label="Currently receiving benefits"
        value={
          profile.benefits_currently_receiving?.length
            ? profile.benefits_currently_receiving.join(', ')
            : profile.benefits_currently_receiving !== null
              ? 'None'
              : null
        }
      />

      {profile.top_needs.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Top needs</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm">
            {profile.top_needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {flags.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Flags</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {flags.map((f) => (
              <span
                key={f}
                className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400"
              >
                {FLAG_LABEL[f]}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {profile.notes ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Caseworker — read this first
          </p>
          <p className="mt-1 text-sm">{profile.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
