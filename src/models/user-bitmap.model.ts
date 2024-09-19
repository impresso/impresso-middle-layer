import { DataTypes, ModelDefined, Sequelize } from 'sequelize'

interface UserBitmapAttributes {
  id: number
  bitmap: string
}

// Define the creation attributes for the Group model
interface UserBitmapCreationAttributes extends Omit<UserBitmapAttributes, 'id'> {}

export default class UserBitmap {
  id: number
  bitmap: string

  constructor({ id = 0, bitmap = '' }) {
    this.id = id
    this.bitmap = bitmap
  }

  static sequelize(client: Sequelize) {
    const userBitmap: ModelDefined<UserBitmapAttributes, UserBitmapCreationAttributes> = client.define(
      'userBitmap',
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          unique: true,
        },
        bitmap: {
          // models.BinaryField
          type: DataTypes.BLOB,
          allowNull: true,
          get() {
            const value = this.getDataValue('bitmap')
            const binaryString = Array.from(value as unknown as Buffer)
              .map(byte => byte.toString(2).padStart(8, '0'))
              .join('')
              .replace(/^0+/, '')
            return binaryString
          },
        },
      },
      {
        tableName: 'impresso_userbitmap',
      }
    )
    return userBitmap
  }
}
