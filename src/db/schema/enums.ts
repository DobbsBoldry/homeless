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

export const bedHoldStatusEnum = pgEnum('bed_hold_status', [
  'active',
  'released',
  'expired',
  'converted',
]);

export type BedHoldStatus = (typeof bedHoldStatusEnum.enumValues)[number];

export const smsConversationStateEnum = pgEnum('sms_conversation_state', [
  'idle',
  'awaiting_location',
]);

export type SmsConversationState = (typeof smsConversationStateEnum.enumValues)[number];

export const triageTierEnum = pgEnum('triage_tier', ['high', 'medium', 'low']);

export type TriageTierEnum = (typeof triageTierEnum.enumValues)[number];

export const clientDocumentKindEnum = pgEnum('client_document_kind', [
  'photo_id',
  'ssn_card',
  'birth_certificate',
  'dd_214',
  'lease',
  'paystub',
  'court_record',
  'other',
]);

export type ClientDocumentKind = (typeof clientDocumentKindEnum.enumValues)[number];

export const clientDocumentStatusEnum = pgEnum('client_document_status', [
  'uploaded',
  'extracting',
  'extracted',
  'failed',
]);

export type ClientDocumentStatus = (typeof clientDocumentStatusEnum.enumValues)[number];

export const fagMemberStatusEnum = pgEnum('fag_member_status', ['active', 'paused', 'ended']);

export type FagMemberStatus = (typeof fagMemberStatusEnum.enumValues)[number];

export const fagPayoutStatusEnum = pgEnum('fag_payout_status', ['unpaid', 'paid', 'voided']);

export type FagPayoutStatus = (typeof fagPayoutStatusEnum.enumValues)[number];

export const clientIntakeStatusEnum = pgEnum('client_intake_status', [
  'recording',
  'transcribed',
  'extracting',
  'extracted',
  'failed',
]);

export type ClientIntakeStatus = (typeof clientIntakeStatusEnum.enumValues)[number];

export const faithMinistryStatusEnum = pgEnum('faith_ministry_status', [
  'opted_in',
  'paused',
  'opted_out',
]);

export type FaithMinistryStatus = (typeof faithMinistryStatusEnum.enumValues)[number];

export const faithAggregatePeriodKindEnum = pgEnum('faith_aggregate_period_kind', [
  'week',
  'month',
  'quarter',
]);

export type FaithAggregatePeriodKind = (typeof faithAggregatePeriodKindEnum.enumValues)[number];

export const partnerAgreementKindEnum = pgEnum('partner_agreement_kind', [
  'mou',
  'ferpa',
  'baa',
  'qsoa',
  'dsa',
  'memo_of_cooperation',
]);

export type PartnerAgreementKind = (typeof partnerAgreementKindEnum.enumValues)[number];

export const partnerAgreementStatusEnum = pgEnum('partner_agreement_status', [
  'draft',
  'active',
  'expired',
  'terminated',
  'superseded',
]);

export type PartnerAgreementStatus = (typeof partnerAgreementStatusEnum.enumValues)[number];

export const partnerServiceEventTypeEnum = pgEnum('partner_service_event_type', [
  'food_pantry',
  'shelter_intake',
  'shelter_bed_night',
  'utility_assistance',
  'rent_assistance',
  'counseling_visit',
  'medical_visit',
  'school_attendance_flag',
  'volunteer_hours',
  'other',
]);

export type PartnerServiceEventType = (typeof partnerServiceEventTypeEnum.enumValues)[number];

// PRVN-003 — FERPA school-referral consent fork (ADR 0005)

export const schoolReferralBasisEnum = pgEnum('school_referral_basis', [
  'mckinney_vento_authorization',
  'parental_consent',
  'eligible_student_consent',
  'directory_info_only',
  'health_safety_emergency',
]);

export type SchoolReferralBasis = (typeof schoolReferralBasisEnum.enumValues)[number];

export const schoolReferralStatusEnum = pgEnum('school_referral_status', [
  'received',
  'triaged',
  'in_progress',
  'connected',
  'closed_unreachable',
  'closed_completed',
]);

export type SchoolReferralStatus = (typeof schoolReferralStatusEnum.enumValues)[number];

export const schoolReferralGradeBandEnum = pgEnum('school_referral_grade_band', [
  'elementary',
  'middle',
  'high',
]);

export type SchoolReferralGradeBand = (typeof schoolReferralGradeBandEnum.enumValues)[number];

export const schoolReferralUrgencyEnum = pgEnum('school_referral_urgency', [
  'low',
  'medium',
  'high',
]);

export type SchoolReferralUrgency = (typeof schoolReferralUrgencyEnum.enumValues)[number];

// SUBP-001 — foster aging-out countdown (ADR 0006)

export const fosterPlacementTypeEnum = pgEnum('foster_placement_type', [
  'family_foster',
  'kinship',
  'group_home',
  'residential',
  'independent_living',
  'unknown',
]);

export type FosterPlacementType = (typeof fosterPlacementTypeEnum.enumValues)[number];

export const fosterYouthStatusEnum = pgEnum('foster_youth_status', [
  'active',
  'aged_out',
  'exited',
]);

export type FosterYouthStatus = (typeof fosterYouthStatusEnum.enumValues)[number];

/**
 * Aging-out alert milestones, in days-until-18 buckets. `aged_out` fires
 * once on the 18th-birthday transition; `d90/d60/d30/d14/d7` fire when the
 * youth crosses into that days-out band.
 */
export const fosterAgingOutMilestoneEnum = pgEnum('foster_aging_out_milestone', [
  'd90',
  'd60',
  'd30',
  'd14',
  'd7',
  'aged_out',
]);

export type FosterAgingOutMilestone = (typeof fosterAgingOutMilestoneEnum.enumValues)[number];

// SUBP-002 — TEAMKY Former Foster Youth Medicaid extension (42 U.S.C. § 1396a(a)(10)(A)(i)(IX))

export const medicaidExtensionStatusEnum = pgEnum('medicaid_extension_status', [
  'drafted',
  'submitted',
  'approved',
  'denied',
  'withdrawn',
]);

export type MedicaidExtensionStatus = (typeof medicaidExtensionStatusEnum.enumValues)[number];

// SUBP-004 — DV survivor pathway (ADR 0007)

export const dvSurvivorStatusEnum = pgEnum('dv_survivor_status', [
  'active',
  'exited',
  'transferred',
  'deceased',
]);

export type DvSurvivorStatus = (typeof dvSurvivorStatusEnum.enumValues)[number];

/**
 * Risk band per Campbell DA scale; `unknown` until OASIS performs the
 * assessment. The banding (not raw score) is what flows under the OASIS
 * DSA's default redaction policy (`risk_tier: 'share'`).
 */
export const dvRiskTierEnum = pgEnum('dv_risk_tier', [
  'unknown',
  'lethality_low',
  'lethality_moderate',
  'lethality_high',
]);

export type DvRiskTier = (typeof dvRiskTierEnum.enumValues)[number];

export const dvSafetyEventTypeEnum = pgEnum('dv_safety_event_type', [
  'intake',
  'safety_plan_update',
  'escalation',
  'service_referral',
  'exit',
]);

export type DvSafetyEventType = (typeof dvSafetyEventTypeEnum.enumValues)[number];
