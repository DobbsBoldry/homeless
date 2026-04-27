/**
 * E2E outbound interceptor — installed once at server startup when
 * E2E_MOCK_OUTBOUND=1 is set. Patches global fetch to:
 *
 *   - Cache Anthropic responses to e2e/.cache/ai/<sha256>.json. Forces
 *     model = claude-haiku-4-5 (via body rewrite) regardless of what
 *     production code requested.
 *   - Record Twilio + Resend payloads to outbound_messages_test and
 *     return synthetic success responses.
 *   - Pass everything else through untouched.
 *
 * No-op when the env var is unset. NEVER affects dev or prod paths.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const CACHE_DIR = join(process.cwd(), 'e2e/.cache/ai');
const ANTHROPIC_HOST = 'api.anthropic.com';
const TWILIO_HOST = 'api.twilio.com';
const RESEND_HOST = 'api.resend.com';
const E2E_MODEL = 'claude-haiku-4-5';

let installed = false;

export function installE2EInterceptor(): void {
  if (installed) return;
  if (process.env.E2E_MOCK_OUTBOUND !== '1') return;
  installed = true;

  const realFetch: typeof fetch = globalThis.fetch.bind(globalThis);

  const patched = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    if (url.includes(ANTHROPIC_HOST)) {
      return interceptAnthropic(url, init, realFetch);
    }
    if (url.includes(TWILIO_HOST)) {
      return interceptTwilio(url, init);
    }
    if (url.includes(RESEND_HOST)) {
      return interceptResend(url, init);
    }
    return realFetch(input, init);
  }) as typeof fetch;

  globalThis.fetch = patched;
  console.log('[e2e] outbound interceptor installed');
}

async function interceptAnthropic(
  url: string,
  init: RequestInit | undefined,
  realFetch: typeof fetch,
): Promise<Response> {
  const bodyText = typeof init?.body === 'string' ? init.body : '';
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return realFetch(url, init);
  }
  parsed.model = E2E_MODEL;
  const rewrittenBody = JSON.stringify(parsed);
  const hash = createHash('sha256').update(rewrittenBody).digest('hex');
  const cachePath = join(CACHE_DIR, `${hash}.json`);

  try {
    const cached = await readFile(cachePath, 'utf8');
    return new Response(cached, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    const realResp = await realFetch(url, { ...init, body: rewrittenBody });
    const respText = await realResp.text();
    if (realResp.ok) {
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(cachePath, respText, 'utf8');
    }
    return new Response(respText, {
      status: realResp.status,
      headers: realResp.headers,
    });
  }
}

async function interceptTwilio(url: string, init: RequestInit | undefined): Promise<Response> {
  // Twilio outbound message API: POST .../Accounts/{Sid}/Messages.json
  if (!url.includes('/Messages')) {
    return new Response('{}', { status: 200 });
  }
  const formBody = typeof init?.body === 'string' ? init.body : '';
  const params = new URLSearchParams(formBody);
  await recordOutbound('twilio.sms', params.get('To') ?? '', params.get('Body') ?? '', {
    from: params.get('From') ?? '',
  });
  return new Response(
    JSON.stringify({
      sid: 'SMe2e0000000000000000000000000000',
      status: 'queued',
      to: params.get('To') ?? '',
      from: params.get('From') ?? '',
      body: params.get('Body') ?? '',
    }),
    { status: 201, headers: { 'content-type': 'application/json' } },
  );
}

async function interceptResend(url: string, init: RequestInit | undefined): Promise<Response> {
  if (!url.includes('/emails')) {
    return new Response('{}', { status: 200 });
  }
  const bodyText = typeof init?.body === 'string' ? init.body : '';
  let parsed: { to?: string | string[]; subject?: string; html?: string; text?: string } = {};
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    /* fall through */
  }
  const to = Array.isArray(parsed.to) ? parsed.to.join(',') : (parsed.to ?? '');
  const body = parsed.html ?? parsed.text ?? '';
  await recordOutbound('resend.email', to, body, { subject: parsed.subject ?? '' });
  return new Response(JSON.stringify({ id: 'e2e-resend-id' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function recordOutbound(
  kind: 'twilio.sms' | 'resend.email',
  to: string,
  body: string,
  meta: Record<string, string>,
): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  // Lazy-import postgres so the file stays light when the interceptor isn't installed.
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, { max: 1, idle_timeout: 1, connect_timeout: 5 });
  try {
    await sql`
      insert into outbound_messages_test (kind, "to", body, metadata)
      values (${kind}, ${to}, ${body}, ${JSON.stringify(meta)}::jsonb)
    `;
  } catch (err) {
    console.error('[e2e] recordOutbound failed:', err);
  } finally {
    await sql.end({ timeout: 1 });
  }
}
