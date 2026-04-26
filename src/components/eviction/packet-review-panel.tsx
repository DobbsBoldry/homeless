'use client';

import { useState, useTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  changePacketStatusAction,
  exportPacketPdfAction,
  generatePacketAction,
  savePacketAction,
} from '@/app/actions/eviction';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EvictionFiling } from '@/db/schema/eviction-filings';
import type { EvictionResponsePacket } from '@/db/schema/eviction-response-packets';

interface Props {
  filing: EvictionFiling;
  packet: EvictionResponsePacket | null;
}

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

const statusBadge: Record<EvictionResponsePacket['status'], string> = {
  draft: 'bg-secondary text-secondary-foreground',
  approved: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
  filed: 'bg-primary text-primary-foreground',
  rejected: 'bg-destructive/15 text-destructive',
};

export function PacketReviewPanel({ filing, packet }: Props) {
  if (!packet) return <NoPacket filing={filing} />;
  return <HasPacket packet={packet} filing={filing} />;
}

function NoPacket({ filing }: { filing: EvictionFiling }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await generatePacketAction(filing.id);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">No packet drafted yet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Generate an AI-drafted Answer to Forcible Detainer Complaint for this case. The draft will
          need attorney review and edits before filing — review carefully.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={onClick} disabled={pending}>
            {pending ? 'Generating…' : 'Generate packet'}
          </Button>
          {error ? <span className="text-destructive text-xs">{error}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function HasPacket({ packet, filing }: { packet: EvictionResponsePacket; filing: EvictionFiling }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(packet.packetMd);
  const [saved, setSaved] = useState(packet.packetMd);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDefendantWarn, setShowDefendantWarn] = useState(true);

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const r = await savePacketAction(packet.id, draft);
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

  const onChangeStatus = (next: EvictionResponsePacket['status']) => {
    setError(null);
    startTransition(async () => {
      const r = await changePacketStatusAction(packet.id, filing.id, next);
      if (!r.ok) setError(r.error);
    });
  };

  const onExport = () => {
    setError(null);
    startTransition(async () => {
      const r = await exportPacketPdfAction(packet.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // Trigger browser download via blob URL
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  };

  const canExport = packet.status === 'approved' || packet.status === 'filed';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Status</CardTitle>
              <p className="text-xs text-muted-foreground">
                Generated {fmtDate(packet.createdAt)} · Last updated {fmtDate(packet.updatedAt)}
              </p>
            </div>
            <span className={`rounded px-2 py-1 text-xs font-medium ${statusBadge[packet.status]}`}>
              {packet.status}
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {packet.status === 'filed' ? (
            <p className="text-xs text-muted-foreground">
              Packet has been filed in court — no further status changes from this UI.
            </p>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || packet.status !== 'draft'}
                onClick={() => onChangeStatus('approved')}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || packet.status !== 'approved'}
                onClick={() => onChangeStatus('filed')}
              >
                Mark filed
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || packet.status === 'rejected'}
                onClick={() => onChangeStatus('rejected')}
              >
                Reject
              </Button>
              {packet.status === 'rejected' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => onChangeStatus('draft')}
                >
                  Re-open as draft
                </Button>
              ) : null}
            </>
          )}
          <span className="ml-auto" />
          <Button
            size="sm"
            variant={canExport ? 'default' : 'outline'}
            disabled={pending || !canExport}
            onClick={onExport}
            title={canExport ? 'Download as PDF' : 'Approve the packet first to enable export'}
          >
            Export PDF
          </Button>
          {error ? <span className="text-destructive text-xs">{error}</span> : null}
        </CardContent>
      </Card>

      {showDefendantWarn ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start justify-between gap-3 pt-4 text-sm">
            <p>
              <strong>Heads up:</strong> this view shows the defendant's full name in the packet
              caption ({filing.defendantFirstName} {filing.defendantLastName}). The case-detail and
              queue views only show initials.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setShowDefendantWarn(false)}>
              Got it
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Packet</CardTitle>
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
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
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
              className="font-mono min-h-[40rem] w-full rounded-md border border-input bg-background p-3 text-sm"
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
