import type { Sequelize } from 'sequelize'
import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import Group from './groups.model'

export default class UserChangePlanRequest extends Model<
  InferAttributes<UserChangePlanRequest>,
  InferCreationAttributes<UserChangePlanRequest>
> {
  declare id: CreationOptional<string>
  declare dateCreated: Date
  declare dateLastModified: Date
  declare status: string
  declare notes: string
  declare changelog: object
  declare planId: number
  declare userId: number

  static initModel(client: Sequelize) {
    const groupModel = Group.initModel(client)
    const model = UserChangePlanRequest.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          unique: true,
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
        status: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        changelog: {
          type: DataTypes.JSON,
          allowNull: false,
        },
        notes: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        planId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'plan_id',
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'user_id',
        },
      },
      {
        sequelize: client,
        tableName: 'impresso_userchangeplanrequest',
      }
    )
    model.hasOne(groupModel, { foreignKey: 'id', sourceKey: 'planId', as: 'plan' })
    return model
  }
}
