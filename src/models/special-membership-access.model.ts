import type { Sequelize } from 'sequelize'
import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize'

import User from './users.model'
import UserSpecialMembershipRequest from './user-special-membership-requests.model'

export interface ISpecialMembershipAccessAttributes {
  id: number
  reviewerId?: number | null
  title: string
  bitmapPosition: number
  metadata?: object
}

export default class SpecialMembershipAccess extends Model<
  InferAttributes<SpecialMembershipAccess>,
  InferCreationAttributes<SpecialMembershipAccess>
> {
  declare id: CreationOptional<number>
  declare reviewerId: ForeignKey<User['id']> | null
  declare title: string
  declare bitmapPosition: number
  declare metadata: object | null
  // Add this to help TypeScript with associations
  declare requests?: UserSpecialMembershipRequest[]

  static initialize(sequelize: Sequelize) {
    const model = SpecialMembershipAccess.init(
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
        title: {
          type: DataTypes.STRING,
          allowNull: false,
          field: 'name',
        },
        bitmapPosition: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'bitmap_position',
        },
        metadata: {
          type: DataTypes.JSON,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'impresso_datasetbitmapposition',
        timestamps: false,
      }
    )

    const userSpecialMembershipRequestModel = UserSpecialMembershipRequest.initialize(sequelize)

    model.hasMany(userSpecialMembershipRequestModel, {
      foreignKey: 'specialMembershipAccessId',
      as: 'requests',
    })

    return model
  }
}
