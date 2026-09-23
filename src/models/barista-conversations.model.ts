import type { Sequelize } from 'sequelize'
import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize'
import User from '@/models/users.model.js'

export default class BaristaConversation extends Model<
  InferAttributes<BaristaConversation>,
  InferCreationAttributes<BaristaConversation>
> {
  declare id: CreationOptional<number>
  declare baristaSessionId: string
  declare label: string
  declare dateCreated: CreationOptional<Date>
  declare dateLastModified: CreationOptional<Date>
  declare userId: ForeignKey<number>

  static initialize(sequelize: Sequelize) {
    return BaristaConversation.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        baristaSessionId: {
          type: DataTypes.STRING,
          allowNull: false,
          field: 'barista_session_id',
        },
        label: {
          type: DataTypes.STRING,
          allowNull: false,
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
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'user_id',
        },
      },
      {
        sequelize,
        tableName: 'impresso_baristaconversation',
        timestamps: false,
      }
    )
  }
}
