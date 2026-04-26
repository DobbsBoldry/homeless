import { dailyAttorneyDigest } from './daily-attorney-digest';
import { dailyCourtnetScrape } from './daily-courtnet-scrape';
import { dailyHealthPing } from './daily-health-ping';
import { expireBedHolds } from './expire-bed-holds';
import { expireSmsConversations } from './expire-sms-conversations';
import { userSignedUp } from './user-signed-up';

export const functions = [
  dailyHealthPing,
  userSignedUp,
  dailyCourtnetScrape,
  dailyAttorneyDigest,
  expireBedHolds,
  expireSmsConversations,
];
