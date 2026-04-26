import { dailyAttorneyDigest } from './daily-attorney-digest';
import { dailyCourtnetScrape } from './daily-courtnet-scrape';
import { dailyHealthPing } from './daily-health-ping';
import { userSignedUp } from './user-signed-up';

export const functions = [dailyHealthPing, userSignedUp, dailyCourtnetScrape, dailyAttorneyDigest];
