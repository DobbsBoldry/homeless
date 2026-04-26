import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'pending',
  'attorney',
  'caseworker',
  'ed_coordinator',
  'shelter_staff',
  'admin',
]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];

export const partnerOrgTypeEnum = pgEnum('partner_org_type', [
  'hospital',
  'legal_aid',
  'shelter',
  'community_org',
  'government',
  'other',
]);

export type PartnerOrgType = (typeof partnerOrgTypeEnum.enumValues)[number];

export const consentTypeEnum = pgEnum('consent_type', [
  'phi_share_within_coalition',
  'sms_communication',
  'data_for_program_eval',
]);

export type ConsentType = (typeof consentTypeEnum.enumValues)[number];

export const consentChannelEnum = pgEnum('consent_channel', [
  'sms',
  'in_person',
  'web_form',
  'phone',
  'paper',
]);

export type ConsentChannel = (typeof consentChannelEnum.enumValues)[number];

export const evictionCauseTypeEnum = pgEnum('eviction_cause_type', [
  'non_payment',
  'lease_violation',
  'holdover',
  'other',
]);

export type EvictionCauseType = (typeof evictionCauseTypeEnum.enumValues)[number];

export const evictionFilingStatusEnum = pgEnum('eviction_filing_status', [
  'filed',
  'served',
  'judgment',
  'dismissed',
  'sealed',
]);

export type EvictionFilingStatus = (typeof evictionFilingStatusEnum.enumValues)[number];

export const evictionFilingSourceEnum = pgEnum('eviction_filing_source', [
  'courtnet',
  'manual',
  'synthetic',
]);

export type EvictionFilingSource = (typeof evictionFilingSourceEnum.enumValues)[number];

export const evictionResponsePacketStatusEnum = pgEnum('eviction_response_packet_status', [
  'draft',
  'approved',
  'filed',
  'rejected',
]);

export type EvictionResponsePacketStatus =
  (typeof evictionResponsePacketStatusEnum.enumValues)[number];
