import * as Sentry from '@sentry/nextjs';
import { parseEvictionFiling } from '@/lib/eviction/parser';
import { selectSource } from '@/lib/eviction/sources';
import { upsertFiling } from '@/lib/eviction/upsert';
import { inngest } from '../client';

/**
 * Daily eviction docket scrape.
 *
 * Cron: 12:00 UTC = 7am Central Standard / 6am Central Daylight. Runs after
 * the courthouse opens, before attorney workflow starts.
 *
 * Source is plugged via selectSource() — `mock` (default) reads
 * fixtures/eviction-filings.json; `courtnet` is a stub until EVDT-001/002
 * close out. Switch via `EVICTION_SOURCE` env var.
 *
 * Each fetched record runs through:
 *   raw -> parseEvictionFiling -> upsertFiling
 * Parse errors are logged + counted but never abort the run.
 *
 * If parse_errors > 5% of fetched, captures a Sentry warning so we know
 * the source contract has drifted.
 */
export const dailyCourtnetScrape = inngest.createFunction(
  {
    id: 'daily-courtnet-scrape',
    retries: 2,
    triggers: [{ cron: '0 12 * * *' }],
  },
  async ({ step, logger }) => {
    const source = selectSource();

    const raws = await step.run('fetch-docket', async () => source.fetchTodaysDocket());

    const counts = {
      fetched: raws.length,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      superseded: 0,
      parse_errors: 0,
    };

    await step.run('parse-and-upsert', async () => {
      for (const raw of raws) {
        const parsed = parseEvictionFiling(raw, source.source);
        if (!parsed.ok) {
          logger.warn('[scraper] parse error', { errors: parsed.errors });
          counts.parse_errors++;
          continue;
        }
        const { action } = await upsertFiling(parsed.filing);
        counts[action]++;
      }
    });

    Sentry.addBreadcrumb({
      category: 'scraper',
      message: 'daily-courtnet-scrape',
      data: { source: source.name, ...counts },
      level: 'info',
    });

    if (counts.fetched > 0 && counts.parse_errors / counts.fetched > 0.05) {
      Sentry.captureMessage(
        `[scraper] high parse-error rate: ${counts.parse_errors}/${counts.fetched}`,
        { level: 'warning', extra: { source: source.name, ...counts } },
      );
    }

    logger.info('[scraper] complete', { source: source.name, ...counts });
    return { source: source.name, ...counts };
  },
);
