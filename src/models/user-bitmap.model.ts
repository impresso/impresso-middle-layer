import { DataTypes, ModelDefined, Sequelize } from 'sequelize'
import SubscriptionDataset, { type SubscriptionDatasetAttributes } from './subscription-datasets.model'
import Group from './groups.model'

export interface UserBitmapAttributes {
  id: number
  user_id: number
  bitmap: string | Buffer
  dateAcceptedTerms: Date | null
  subscriptionDatasets: SubscriptionDatasetAttributes[]
}

// Define the creation attributes for the Group model
interface UserBitmapCreationAttributes extends Omit<UserBitmapAttributes, 'id'> {}

export const BufferUserPlanGuest = BigInt(0b10000)
export const BufferUserPlanAuthUser = BigInt(0b11000)
export const BufferUserPlanEducational = BigInt(0b11100)
export const BufferUserPlanResearcher = BigInt(0b11110)

export const PlanResearcher = 'plan-researcher'
export const PlanEducational = 'plan-educational'

export const MaxBitmapPositionForPlan = 5

export default class UserBitmap {
  id: number
  user_id: number
  bitmap: string | Buffer
  dateAcceptedTerms: Date | null
  subscriptionDatasets: SubscriptionDatasetAttributes[]

  constructor({
    id = 0,
    user_id = 0,
    bitmap = '',
    dateAcceptedTerms = null,
    subscriptionDatasets = [],
  }: UserBitmapAttributes) {
    this.id = id
    this.user_id = user_id
    this.bitmap = bitmap
    this.dateAcceptedTerms = dateAcceptedTerms
    this.subscriptionDatasets = subscriptionDatasets
  }

  static getUpToDateBitmap(userBitmap: UserBitmap, groups: Group[]): Buffer {
    const dateAcceptedTerms = userBitmap.dateAcceptedTerms
    if (!dateAcceptedTerms) {
      return Buffer.from([Number(BufferUserPlanGuest)])
    }
    // if user accepted terms, we can check if he has a more specific plan
    let bitmap: bigint = BufferUserPlanAuthUser
    const groupNames: string[] = groups.map(g => g.name)
    if (groupNames.includes(PlanResearcher)) {
      bitmap = BufferUserPlanResearcher
    } else if (groupNames.includes(PlanEducational)) {
      bitmap = BufferUserPlanEducational
    }
    if (!Array.isArray(userBitmap.subscriptionDatasets) || userBitmap.subscriptionDatasets.length === 0) {
      return Buffer.from([Number(bitmap)])
    }
    // Max bitmap position
    const maxPosition =
      Math.max(...userBitmap.subscriptionDatasets.map(sub => sub.bitmapPosition)) + MaxBitmapPositionForPlan + 1
    console.log('userBitmap.subscriptionDatasets maxPosition', maxPosition)

    // Shift the initial bitmap to adjust for the maximum bit position
    bitmap = bitmap << BigInt(maxPosition - MaxBitmapPositionForPlan)

    // Set bits according to the subscription bitmap positions
    userBitmap.subscriptionDatasets.forEach(subscription => {
      const position = subscription.bitmapPosition + MaxBitmapPositionForPlan
      bitmap |= BigInt(1) << BigInt(maxPosition - position - 1)
    }) // Convert the updated bitmap to a buffer
    const buffer = Buffer.alloc(8) // Allocate 8 bytes for the bitmap (64 bits)
    buffer.writeBigUInt64BE(bitmap) // Write the bitmap as a 64-bit unsigned integer in Big Endian format

    return buffer
  }

  static sequelize(client: Sequelize) {
    const subscriptionDataset = SubscriptionDataset.sequelize(client)
    const userBitmapSubscriptionDataset = client.define(
      'userBitmapSubscriptionDataset',
      {
        userBitmapId: {
          type: DataTypes.INTEGER,
          field: 'userbitmap_id',
        },
        subscriptionDatasetId: {
          type: DataTypes.INTEGER,
          field: 'datasetbitmapposition_id',
        },
      },
      {
        tableName: 'impresso_userbitmap_subscriptions',
      }
    )
    const userBitmap: ModelDefined<UserBitmapAttributes, UserBitmapCreationAttributes> = client.define(
      'userBitmap',
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          unique: true,
        },
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          unique: true,
          field: 'user_id',
        },
        bitmap: {
          // models.BinaryField
          type: DataTypes.BLOB,
          allowNull: true,
          defaultValue: Buffer.from([Number(BufferUserPlanGuest)]),
          get() {
            const value = this.getDataValue('bitmap')
            const binaryString = Array.from(value as unknown as Buffer)
              .map(byte => byte.toString(2).padStart(8, '0'))
              .join('')
              .replace(/^0+/, '')
            return binaryString
          },
        },
        dateAcceptedTerms: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'date_accepted_terms',
        },
      },
      {
        tableName: 'impresso_userbitmap',
        defaultScope: {
          include: [
            {
              model: subscriptionDataset,
              as: 'subscriptionDatasets',
            },
          ],
        },
      }
    )
    userBitmap.belongsToMany(subscriptionDataset, {
      through: userBitmapSubscriptionDataset,
      foreignKey: 'userBitmapId',
      otherKey: 'subscriptionDatasetId',
      as: 'subscriptionDatasets',
    })

    userBitmap.prototype.toJSON = function () {
      const userBitmap = this.get() as UserBitmapAttributes
      return new UserBitmap({
        ...userBitmap,
        subscriptionDatasets: (userBitmap.subscriptionDatasets ?? []).map((dataset: any) => dataset.toJSON()),
      })
    }

    return userBitmap
  }
}
