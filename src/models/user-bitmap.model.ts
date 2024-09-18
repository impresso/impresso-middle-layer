import { DataTypes, type Sequelize } from 'sequelize'

export default class UserBitmap {
  constructor({ bitmap }) {
    this.bitmap = bitmap
  }

  static sequelize(client: Sequelize) {
    return client.define('userBitmap', {
      userId: {
        field: 'user_id',
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      bitmap: {
        // models.BinaryField
        type: DataTypes.BLOB,
        allowNull: true,
      },
    })
  }
}
