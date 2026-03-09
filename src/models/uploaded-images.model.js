import User from './users.model'
import { DataTypes } from 'sequelize'

class UploadedImage {
  constructor({ id = '', name = '', checksum = '', signature = '', thumbnail = '', creationDate = new Date() } = {}) {
    this.id = String(id)
    this.name = String(name)
    this.checksum = String(checksum)
    this.signature = String(signature)
    this.thumbnail = String(thumbnail)
    this.creationDate = new Date(creationDate)
  }

  static sequelize(client) {
    const creator = User.sequelize(client)
    // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
    // for more of what you can do here.
    const uploadedImage = client.define(
      'uploadedImage',
      {
        id: {
          type: DataTypes.STRING(50),
          primaryKey: true,
          unique: true,
          field: 'id',
        },
        name: {
          type: DataTypes.STRING(100),
          allowNull: true,
          defaultValue: '',
        },
        checksum: {
          type: DataTypes.STRING(32),
          allowNull: true,
          defaultValue: '',
          field: 'md5_checksum',
        },
        signature: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        thumbnail: {
          type: DataTypes.TEXT,
          allowNull: true,
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
        creatorId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'creator_id',
        },
      },
      {
        tableName: 'uploaded_images',
        defaultScope: {
          include: [
            {
              model: creator,
              as: 'creator',
            },
          ],
        },
      }
    )

    uploadedImage.belongsTo(creator, {
      as: 'creator',
      foreignKey: {
        fieldName: 'creator_id',
      },
      onDelete: 'CASCADE',
    })

    uploadedImage.prototype.toJSON = function () {
      const instance = new UploadedImage({
        id: this.id,
        thumbnail: this.thumbnail,
        creationDate: this.creationDate,
        lastModifiedDate: this.lastModifiedDate,
        signature: this.signature,
        name: this.name,
      })
      return instance
    }

    return uploadedImage
  }
}

export default UploadedImage
