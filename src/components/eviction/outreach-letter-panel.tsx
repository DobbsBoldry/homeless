'use client';

import { useId, useState, useTransition } from 'react';
import {
  exportOutreachLetterPdfAction,
  generateOutreachLetterAction,
} from '@/app/actions/eviction';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function OutreachLetterPanel({ filingId }: { filingId: string }) {
  const textareaId = useId();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onGenerate = () => {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await generateOutreachLetterAction(filingId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setText(result.text);
    });
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — select the text manually.');
    }
  };

  const onExportPdf = () => {
    setError(null);
    startTransition(async () => {
      const r = await exportOutreachLetterPdfAction(filingId, text);
      if (!r.ok) {
        setError(r.error);
        return;
      }
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between gap-2">
        <CardTitle className="text-base">Tenant outreach letter</CardTitle>
        {text ? (
          <Button onClick={onGenerate} disabled={pending} size="sm" variant="outline">
            {pending ? 'Drafting…' : 'Re-draft'}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!text ? (
          <>
            <p className="text-muted-foreground">
              Draft a plain-language letter inviting the tenant to call KLA for free legal help. AI
              writes it from the filing facts only — no PHI. You review, edit, and mail it.
            </p>
            <div className="flex items-center gap-3">
              <Button onClick={onGenerate} disabled={pending} size="sm">
                {pending ? 'Drafting…' : 'Draft outreach letter'}
              </Button>
              {error ? <span className="text-destructive text-xs">{error}</span> : null}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Edit freely below before sending. Replace{' '}
              <code className="font-mono">[KLA Owensboro phone]</code> with the real number, paste
              into letterhead, mail it. The AI is not your attorney — read every word.
            </p>
            <label htmlFor={textareaId} className="sr-only">
              Outreach letter draft
            </label>
            <textarea
              id={textareaId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={18}
              className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs leading-relaxed"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" variant="outline" onClick={onCopy}>
                {copied ? 'Copied ✓' : 'Copy to clipboard'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={onExportPdf}
              >
                {pending ? 'Exporting…' : 'Export PDF'}
              </Button>
              <span className="text-xs text-muted-foreground">{text.length} chars</span>
              {error ? <span className="text-destructive text-xs">{error}</span> : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
