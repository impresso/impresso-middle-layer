import type { ISpecialMembershipAccessAttributes } from '@/models/special-membership-access.model.js'
import {
  StatusPending,
  type IUserSpecialMembershipRequestAttributes,
} from '@/models/user-special-membership-requests.model.js'

export const generateMockUserSpecialMembershipRequest = (
  id: number,
  user: any,
  specialMembershipAccess: ISpecialMembershipAccessAttributes,
  notes = 'Initial request',
  date = new Date()
): IUserSpecialMembershipRequestAttributes => ({
  id: id,
  reviewerId: null,
  userId: user.id,
  specialMembershipAccessId: specialMembershipAccess.id,
  dateCreated: date,
  dateLastModified: date,
  temporaryExpiresAt: null,
  status: StatusPending,
  notes,
  changelog: [
    {
      status: StatusPending,
      subscription: specialMembershipAccess.title,
      date: date.toISOString(),
      reviewer: '',
      notes,
    },
  ],
})
