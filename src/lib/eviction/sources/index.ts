import { courtnet } from './courtnet';
import { courtnetMock } from './courtnet-mock';
import type { DocketSource } from './types';

export type { DocketSource, RawFiling } from './types';

/**
 * Source selection — driven by EVICTION_SOURCE env var.
 * Default is `mock` so dev / staging can run the scraper end-to-end
 * without depending on real CourtNet access.
 */
export function selectSource(): DocketSource {
  const tag = (process.env.EVICTION_SOURCE ?? 'mock').toLowerCase();
  switch (tag) {
    case 'courtnet':
      return courtnet;
    case 'mock':
      return courtnetMock;
    default:
      console.warn(`[sources] unknown EVICTION_SOURCE=${tag} — falling back to mock`);
      return courtnetMock;
  }
}
