import { DataTypes, type Sequelize } from 'sequelize'
import { Model, Optional, ModelDefined } from 'sequelize'

interface GroupAttributes {
  id: number
  name: string
}
// You can also set multiple attributes optional at once
interface GroupCreationAttributes extends Omit<GroupAttributes, 'id'> {}

export default class Group {
  id: string
  name: string

  constructor({ id = '', name = '' } = {}) {
    this.id = String(id)
    this.name = String(name)
  }

  static sequelize(client: Sequelize) {
    // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
    // for more of what you can do here.
    const group: ModelDefined<GroupAttributes, GroupCreationAttributes> = client.define(
      'group',
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          unique: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
      },
      {
        tableName: 'auth_group',
      }
    )

    group.prototype.toJSON = function () {
      const { id, name } = this as unknown as Group
      return new Group({ id, name })
    }
    return group
  }
}
