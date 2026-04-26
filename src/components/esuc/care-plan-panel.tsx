'use client';

import { useState, useTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  changeCarePlanStatusAction,
  generateCarePlanAction,
  saveCarePlanAction,
} from '@/app/actions/care';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EsucCarePlan } from '@/db/schema/esuc-care-plans';

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

const statusBadge: Record<EsucCarePlan['status'], string> = {
  draft: 'bg-secondary text-secondary-foreground',
  approved: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
  active: 'bg-primary text-primary-foreground',
  archived: 'bg-muted text-muted-foreground',
};

export function CarePlanPanel({
  patientId,
  plan,
}: {
  patientId: string;
  plan: EsucCarePlan | null;
}) {
  if (!plan) return <NoPlan patientId={patientId} />;
  return <HasPlan plan={plan} patientId={patientId} />;
}

function NoPlan({ patientId }: { patientId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await generateCarePlanAction(patientId);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">No care plan drafted yet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Generate an AI-drafted care plan from the patient's encounter history. The draft will need
          coordinator review before activation.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={onClick} disabled={pending}>
            {pending ? 'Generating…' : 'Generate care plan'}
          </Button>
          {error ? <span className="text-destructive text-xs">{error}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function HasPlan({ plan, patientId }: { plan: EsucCarePlan; patientId: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(plan.planMd);
  const [saved, setSaved] = useState(plan.planMd);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const r = await saveCarePlanAction(plan.id, draft);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved(draft);
      setEditing(false);
    });
  };

  const onDiscard = () => {
    setDraft(saved);
    setEditing(false);
    setError(null);
  };

  const onChangeStatus = (next: EsucCarePlan['status']) => {
    setError(null);
    startTransition(async () => {
      const r = await changeCarePlanStatusAction(plan.id, patientId, next);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Care plan status</CardTitle>
              <p className="text-xs text-muted-foreground">
                Generated {fmtDate(plan.createdAt)} · Last updated {fmtDate(plan.updatedAt)}
              </p>
            </div>
            <span className={`rounded px-2 py-1 text-xs font-medium ${statusBadge[plan.status]}`}>
              {plan.status}
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {plan.status === 'archived' ? (
            <p className="text-xs text-muted-foreground">
              Plan archived — generate a new plan to re-engage this patient.
            </p>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || plan.status !== 'draft'}
                onClick={() => onChangeStatus('approved')}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || plan.status !== 'approved'}
                onClick={() => onChangeStatus('active')}
              >
                Activate
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => onChangeStatus('archived')}
              >
                Archive
              </Button>
            </>
          )}
          {error ? <span className="text-destructive text-xs">{error}</span> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Plan</CardTitle>
            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" disabled={pending} onClick={onDiscard}>
                  Discard
                </Button>
                <Button size="sm" disabled={pending} onClick={onSave}>
                  {pending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={plan.status === 'archived'}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="font-mono min-h-[36rem] w-full rounded-md border border-input bg-background p-3 text-sm"
              spellCheck
            />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{saved}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
