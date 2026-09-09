import type { ISpecialMembershipAccessAttributes } from '@/models/special-membership-access.model.js'

export const MockSubscriptionGoldWithCCReviewer: ISpecialMembershipAccessAttributes = {
  id: 1,
  title: 'gold',
  fullname: 'Gold Partner Institution',
  countryCode: 'CH',
  dataProviderAlias: 'gold-partner',
  bitmapPosition: 1,
  metadata: {
    modality: 'cc_reviewer',
    enableTemporaryAutomaticApproval: false,
    revokeTemporaryAutomaticApprovalAfterDays: null,
  },
}

export const MockSubscriptionSilverWithAutoApproval: ISpecialMembershipAccessAttributes = {
  id: 2,
  title: 'silver',
  fullname: 'Silver Partner Institution',
  countryCode: 'FR',
  dataProviderAlias: 'silver-partner',
  bitmapPosition: 2,
  metadata: {
    modality: 'notify_reviewer',
    enableTemporaryAutomaticApproval: true,
    revokeTemporaryAutomaticApprovalAfterDays: 14,
  },
}

export const MockSubscriptionsBronzePlatinumDiamond: ISpecialMembershipAccessAttributes[] = [
  {
    id: 3,
    title: 'bronze',
    fullname: 'Bronze Partner Institution',
    countryCode: 'DE',
    dataProviderAlias: 'bronze-partner',
    bitmapPosition: 3,
  },
  {
    id: 4,
    title: 'platinum',
    fullname: 'Platinum Partner Institution',
    countryCode: 'IT',
    dataProviderAlias: 'platinum-partner',
    bitmapPosition: 4,
  },
  {
    id: 5,
    title: 'diamond',
    fullname: 'Diamond Partner Institution',
    countryCode: 'LU',
    dataProviderAlias: 'diamond-partner',
    bitmapPosition: 5,
  },
]

/**
 * Specific mock subscription with revokable access after a certain number of days,
 * used to test the related logic in the service.
 */
export const MockSubscriptionWithRevokableAfterDays: ISpecialMembershipAccessAttributes = {
  id: 6,
  title: 'revokable',
  fullname: 'Revokable Partner Institution',
  countryCode: 'CH',
  dataProviderAlias: 'revokable-partner',
  bitmapPosition: 6,
  metadata: {
    modality: 'cc_reviewer',
    enableTemporaryAutomaticApproval: false,
    revokeAfterDays: 7,
  },
}

/**
 * Specific mock subscription with temporary automatic approval and revokable temporary access after a certain number of days,
 */
export const MockSubscriptionWithRevokableTemporaryAfterDays: ISpecialMembershipAccessAttributes = {
  id: 7,
  title: 'revokable-temporary',
  fullname: 'Revokable Temporary Partner Institution',
  countryCode: 'CH',
  dataProviderAlias: 'revokable-temporary-partner',
  bitmapPosition: 7,
  metadata: {
    modality: 'cc_reviewer',
    enableTemporaryAutomaticApproval: true,
    revokeTemporaryAutomaticApprovalAfterDays: 3,
  },
}

export const mockSpecialMembershipAccesses: ISpecialMembershipAccessAttributes[] = [
  MockSubscriptionGoldWithCCReviewer,
  MockSubscriptionSilverWithAutoApproval,
  ...MockSubscriptionsBronzePlatinumDiamond,
  MockSubscriptionWithRevokableAfterDays,
  MockSubscriptionWithRevokableTemporaryAfterDays,
]
