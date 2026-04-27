'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { extractClientIntakeAction, saveClientIntakeAction } from '@/app/actions/client-intakes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Browser-only types — guarded for SSR.
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex: number;
};
type SpeechRecognitionErrorEventLike = { error: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (e: SpeechRecognitionEventLike) => void;
  onerror: (e: SpeechRecognitionErrorEventLike) => void;
  onend: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const fmtDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function IntakeRecorder() {
  const router = useRouter();
  const labelId = useId();
  const refId = useId();
  const transcriptId = useId();

  const [label, setLabel] = useState('');
  const [refValue, setRef] = useState('');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [elapsed, setElapsed] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupportError(
        "This browser doesn't support live speech recognition. Use Chrome / Edge / Safari, or paste a transcript directly below.",
      );
    }
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* noop */
      }
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const startRecording = () => {
    setError(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      let finalChunk = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (finalChunk) {
        setTranscript((prev) => (prev ? `${prev} ${finalChunk}`.trim() : finalChunk.trim()));
      }
      setInterimText(interim);
    };
    rec.onerror = (e) => {
      setError(`Recognition error: ${e.error}`);
    };
    rec.onend = () => {
      setIsRecording(false);
      setInterimText('');
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
    recognitionRef.current = rec;
    startedAtRef.current = Date.now();
    setElapsed(0);
    tickRef.current = setInterval(() => {
      if (startedAtRef.current) {
        setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    rec.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (isRecording) stopRecording();
    startTransition(async () => {
      const saved = await saveClientIntakeAction({
        label,
        transcriptMd: transcript,
        syntheticPersonRef: refValue.trim() || null,
        audioDurationSec: elapsed > 0 ? elapsed : null,
      });
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      // Kick extraction. Soft-fail if it errors; user lands on the
      // detail page either way and can retry there.
      const extracted = await extractClientIntakeAction(saved.id);
      if (!extracted.ok) {
        console.warn('[intake-recorder] extraction failed:', extracted.error);
      }
      router.push(`/app/clients/intakes/${saved.id}`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={labelId}>Label</Label>
          <Input
            id={labelId}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='e.g. "Marisol intake 4/26"'
            disabled={pending}
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={refId}>Synthetic person ref (optional)</Label>
          <Input
            id={refId}
            value={refValue}
            onChange={(e) => setRef(e.target.value)}
            placeholder="SYN-PERSON-001"
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-card p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            Recording{' '}
            {isRecording ? (
              <span className="text-destructive">● {fmtDuration(elapsed)}</span>
            ) : elapsed > 0 ? (
              <span className="text-muted-foreground">stopped at {fmtDuration(elapsed)}</span>
            ) : null}
          </p>
          <div className="flex gap-2">
            {!isRecording ? (
              <Button
                type="button"
                size="sm"
                disabled={pending || supportError !== null}
                onClick={startRecording}
              >
                {elapsed > 0 ? 'Resume' : 'Start recording'}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={stopRecording}
              >
                Stop
              </Button>
            )}
          </div>
        </div>
        {supportError ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">{supportError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Browser-native transcription via Web Speech API. No audio leaves the laptop. Edit the
            transcript freely below before extraction runs.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor={transcriptId}>Transcript</Label>
        <textarea
          id={transcriptId}
          value={transcript + (interimText ? ` ${interimText}` : '')}
          onChange={(e) => {
            setTranscript(e.target.value);
            setInterimText('');
          }}
          rows={14}
          disabled={pending}
          required
          minLength={20}
          maxLength={50_000}
          placeholder="Live transcript appears here as you speak. You can also paste an existing transcript instead — caseworker workflow choice."
          className="w-full rounded-md border border-input bg-background p-2 text-sm font-mono"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending || transcript.trim().length < 20}>
        {pending ? 'Saving + extracting…' : 'Save & extract profile'}
      </Button>
    </form>
  );
}
