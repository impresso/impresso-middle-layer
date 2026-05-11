import type { ModelStatic, Sequelize } from 'sequelize'
import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize'

import SpecialMembershipAccess from './special-membership-access.model.js'
import User from './users.model.js'

export const StatusPending = 'pending'
export const StatusPendingTemporary = 'pending-t'
export const StatusApproved = 'approved'
export const StatusRejected = 'rejected'
export const StatusRevoked = 'revoked'
export const StatusTemporarilyApproved = 'temporary'
export const AvailableStatuses = [
  StatusPending,
  StatusPendingTemporary,
  StatusApproved,
  StatusRejected,
  StatusTemporarilyApproved,
  StatusRevoked,
] as const

interface ChangelogEntry {
  status: (typeof AvailableStatuses)[number]
  subscription: string
  date: string
  temporary_expires_at?: string | null
  reviewer: string
  notes: string
}

export interface IUserSpecialMembershipRequestAttributes {
  id: number
  reviewerId: number | null
  userId: number
  specialMembershipAccessId: number | null
  dateCreated: Date
  dateLastModified: Date
  temporaryExpiresAt?: Date | null
  status: (typeof AvailableStatuses)[number]
  changelog: ChangelogEntry[]
  notes?: string | null
}

export default class userSpecialMembershipRequestModel extends Model<
  InferAttributes<userSpecialMembershipRequestModel>,
  InferCreationAttributes<userSpecialMembershipRequestModel>
> {
  declare id: CreationOptional<number>
  declare reviewerId: ForeignKey<User['id']> | null
  declare userId: ForeignKey<User['id']>
  declare specialMembershipAccessId: ForeignKey<SpecialMembershipAccess['id']> | null
  declare dateCreated: CreationOptional<Date>
  declare dateLastModified: CreationOptional<Date>
  declare temporaryExpiresAt: CreationOptional<Date> | null
  declare status: (typeof AvailableStatuses)[number]
  declare changelog: ChangelogEntry[]
  declare notes: string | null
  declare specialMembershipAccess?: SpecialMembershipAccess

  static initialize(sequelize: Sequelize) {
    const model = userSpecialMembershipRequestModel.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          unique: true,
        },
        reviewerId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'reviewer_id',
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'user_id',
        },
        specialMembershipAccessId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'subscription_id',
        },
        dateCreated: {
          type: DataTypes.DATE,
          allowNull: false,
          field: 'date_created',
        },
        dateLastModified: {
          type: DataTypes.DATE,
          allowNull: false,
          field: 'date_last_modified',
        },
        temporaryExpiresAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'temporary_expires_at',
          defaultValue: null,
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        changelog: {
          type: DataTypes.JSON,
          allowNull: false,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: '',
        },
      },
      {
        sequelize,
        tableName: 'impresso_userrequest',
        timestamps: false,
      }
    )

    const userModel = User.sequelize(sequelize)

    // Associations here because User is not yet defined ad Sequelize 6 Model
    model.belongsTo(userModel, {
      foreignKey: 'reviewerId',
      as: 'reviewer',
    })

    model.belongsTo(userModel, {
      foreignKey: 'userId',
      as: 'subscriber',
    })

    userSpecialMembershipRequestModel.belongsTo(SpecialMembershipAccess, {
      foreignKey: 'specialMembershipAccessId',
      as: 'specialMembershipAccess',
    })

    return model
  }
}
