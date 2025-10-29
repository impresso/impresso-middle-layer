import type { ModelStatic, Sequelize } from 'sequelize'
import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize'

import User from './users.model'

/**
 * Database model interface for user collections.
 */
export interface IUserCollection {
  id: string
  creatorId: number
  name: string
  description?: string | null
  status: 'PRI' | 'SHA' | 'PUB' | 'DEL'
  creationDate: Date
  lastModifiedDate: Date
}

export default class UserCollection extends Model<
  InferAttributes<UserCollection>,
  InferCreationAttributes<UserCollection>
> {
  declare id: CreationOptional<string>
  declare creatorId: ForeignKey<User['id']>
  declare name: string
  declare description: string | null
  declare status: 'PRI' | 'SHA' | 'PUB' | 'DEL'
  declare creationDate: CreationOptional<Date>
  declare lastModifiedDate: CreationOptional<Date>

  private static get userModel(): ModelStatic<Model> {
    return User as unknown as ModelStatic<Model>
  }

  static initialize(sequelize: Sequelize) {
    return UserCollection.init(
      {
        id: {
          type: DataTypes.STRING(50),
          primaryKey: true,
          unique: true,
        },
        creatorId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'creator_id',
          references: {
            model: this.userModel,
            key: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        name: {
          type: DataTypes.STRING(500),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: '',
        },
        status: {
          type: DataTypes.TEXT('tiny'),
          defaultValue: 'PRI',
        },
        creationDate: {
          type: DataTypes.DATE,
          field: 'date_created',
          defaultValue: DataTypes.NOW,
        },
        lastModifiedDate: {
          type: DataTypes.DATE,
          field: 'date_last_modified',
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'collections',
        modelName: 'UserCollection',
        underscored: true,
        timestamps: false,
      }
    )
  }

  static associate() {
    UserCollection.belongsTo(this.userModel, {
      as: 'creator',
      foreignKey: 'creator_id',
      targetKey: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    })
  }
}
