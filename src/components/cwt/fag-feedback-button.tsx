'use client';

import { MessageSquarePlus, Star } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { submitFagFeedbackAction } from '@/app/actions/fag-feedback';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  FAG_FEEDBACK_CATEGORIES,
  FAG_FEEDBACK_CATEGORY_LABELS,
  MAX_RATING,
} from '@/lib/cwt/fag-feedback';
import { cn } from '@/lib/utils';

/**
 * CWT-023a — floating "Give Feedback" button shown only to active advisory
 * members (the parent layout gates rendering on a `fag_members` match). The
 * route is auto-detected from the current pathname.
 */
export function FagFeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setRating(0);
    setCategory('');
    setError(null);
    setDone(false);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const submit = (fd: FormData) => {
    setError(null);
    fd.set('route', pathname);
    fd.set('rating', String(rating));
    startTransition(async () => {
      const r = await submitFagFeedbackAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(true);
    });
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 shadow-lg"
        size="sm"
      >
        <MessageSquarePlus className="size-4" />
        Give feedback
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advisory feedback</DialogTitle>
            <DialogDescription>
              Tell us how the tool and our services are working. Your note is tied to this page (
              {pathname}).
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="space-y-3">
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                Thanks — your feedback was recorded.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                <Link
                  href="/app/fag/submissions"
                  className="text-sm underline underline-offset-4 hover:text-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  View my feedback
                </Link>
              </div>
            </div>
          ) : (
            <form action={submit} className="space-y-4">
              <div className="space-y-1">
                <Label>Rating</Label>
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
                  {Array.from({ length: MAX_RATING }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                      aria-pressed={rating === n}
                      onClick={() => setRating(n)}
                      className="rounded p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Star
                        className={cn(
                          'size-6',
                          n <= rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground/40',
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="fag-feedback-category">Category</Label>
                <select
                  id="fag-feedback-category"
                  name="category"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="" disabled>
                    Choose a category…
                  </option>
                  {FAG_FEEDBACK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {FAG_FEEDBACK_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="fag-feedback-comment">Comment (optional)</Label>
                <textarea
                  id="fag-feedback-comment"
                  name="comment"
                  rows={4}
                  maxLength={2000}
                  placeholder="What happened? What would help?"
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {error ? <p className="text-destructive text-sm">{error}</p> : null}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending || rating === 0}>
                  {pending ? 'Sending…' : 'Submit feedback'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
