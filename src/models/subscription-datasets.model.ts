import { DataTypes, ModelDefined, Sequelize } from 'sequelize'

export interface SubscriptionDatasetAttributes {
  id: number
  reviewerId?: number | null
  name: string
  bitmapPosition: number
  metadata?: object
}

// Define the creation attributes for the Group model
interface SubscriptionDatasetCreationAttributes extends Omit<SubscriptionDatasetAttributes, 'id'> {}

export default class SubscriptionDataset {
  id: number
  reviewerId?: number | null
  name: string
  bitmapPosition: number
  metadata?: object

  constructor({ id = 0, reviewerId = 0, name = '', bitmapPosition = 0, metadata = {} }) {
    this.id = id
    this.reviewerId = reviewerId
    this.name = name
    this.bitmapPosition = bitmapPosition
    this.metadata = metadata
  }

  static sequelize(client: Sequelize) {
    const subscriptionDataset: ModelDefined<SubscriptionDatasetAttributes, SubscriptionDatasetCreationAttributes> =
      client.define(
        'subscriptionDataset',
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
          name: {
            type: DataTypes.STRING,
            allowNull: false,
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
          tableName: 'impresso_datasetbitmapposition',
        }
      )

    subscriptionDataset.prototype.toJSON = function () {
      const { id, name, reviewerId, bitmapPosition, metadata } = this as any as SubscriptionDatasetAttributes
      return new SubscriptionDataset({
        id,
        name,
        bitmapPosition,
        metadata,
        reviewerId: reviewerId ?? undefined,
      })
    }
    return subscriptionDataset
  }
}
