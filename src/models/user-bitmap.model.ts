import { DataTypes, ModelDefined, Sequelize } from 'sequelize'
import { bigIntToBuffer, bufferToBigInt } from '@/util/bigint.js'

export interface UserBitmapAttributes {
  id: number
  user_id: number
  bitmap: bigint
  dateAcceptedTerms: Date | null
}

// Define the creation attributes for the Group model
interface UserBitmapCreationAttributes extends Omit<UserBitmapAttributes, 'id'> {}

export const BufferUserPlanGuest = BigInt(0b1)
export const BufferUserPlanAuthUser = BigInt(0b11)
export const BufferUserPlanEducational = BigInt(0b111)
export const BufferUserPlanResearcher = BigInt(0b1011)

export default class UserBitmap {
  id: number
  user_id: number
  bitmap: bigint
  dateAcceptedTerms: Date | null

  constructor({ id = 0, user_id = 0, bitmap = BufferUserPlanGuest, dateAcceptedTerms = null }: UserBitmapAttributes) {
    this.id = id
    this.user_id = user_id
    this.bitmap = bitmap
    this.dateAcceptedTerms = dateAcceptedTerms
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
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          unique: true,
          field: 'user_id',
        },
        bitmap: {
          // Storing the bitmap as a BLOB
          type: DataTypes.BLOB,
          allowNull: true,
          defaultValue: bigIntToBuffer(BufferUserPlanGuest),
          get() {
            return bufferToBigInt(this.getDataValue('bitmap') as any as Buffer)
          },
          set(value: bigint) {
            this.setDataValue('bitmap', bigIntToBuffer(value) as any as bigint)
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
      }
    )

    userBitmap.prototype.toJSON = function () {
      return new UserBitmap(this.get() as UserBitmapAttributes)
    }

    return userBitmap
  }
}
