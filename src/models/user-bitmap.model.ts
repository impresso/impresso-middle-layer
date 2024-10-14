import { DataTypes, ModelDefined, Sequelize } from 'sequelize'
import SubscriptionDataset, { type SubscriptionDatasetAttributes } from './subscription-datasets.model'

export interface UserBitmapAttributes {
  id: number
  user_id: number
  bitmap: string
  dateAcceptedTerms: Date | null
  subscriptionDatasets: SubscriptionDatasetAttributes[]
}

// Define the creation attributes for the Group model
interface UserBitmapCreationAttributes extends Omit<UserBitmapAttributes, 'id'> {}

export default class UserBitmap {
  id: number
  user_id: number
  bitmap: string
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
          defaultValue: Buffer.from([0b11000]),
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
        subscriptionDatasets: userBitmap.subscriptionDatasets.map((dataset: any) => dataset.toJSON()),
      })
    }

    return userBitmap
  }
}
