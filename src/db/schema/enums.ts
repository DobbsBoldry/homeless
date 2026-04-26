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
  'faith_based',
  'school',
  'philanthropy',
  'education',
  'public_health',
  'media',
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

export const evictionCaseOutcomeEnum = pgEnum('eviction_case_outcome', [
  'dismissed',
  'judgment_for_plaintiff',
  'judgment_for_defendant',
  'settled',
  'default_judgment',
  'withdrawn',
]);

export type EvictionCaseOutcome = (typeof evictionCaseOutcomeEnum.enumValues)[number];

export const housingStatusEnum = pgEnum('housing_status', [
  'housed',
  'doubled_up',
  'shelter',
  'unsheltered',
  'unknown',
]);

export type HousingStatus = (typeof housingStatusEnum.enumValues)[number];

export const edEncounterSourceEnum = pgEnum('ed_encounter_source', [
  'synthetic',
  'epic_fhir',
  'manual',
]);

export type EdEncounterSource = (typeof edEncounterSourceEnum.enumValues)[number];

export const esucCarePlanStatusEnum = pgEnum('esuc_care_plan_status', [
  'draft',
  'approved',
  'active',
  'archived',
]);

export type EsucCarePlanStatus = (typeof esucCarePlanStatusEnum.enumValues)[number];

export const dataSharingTierEnum = pgEnum('data_sharing_tier', ['none', 'aggregate', 'individual']);

export type DataSharingTier = (typeof dataSharingTierEnum.enumValues)[number];
