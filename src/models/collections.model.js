import User from './users.model'
import { nanoid } from 'nanoid'

const { DataTypes } = require('sequelize')

export const STATUS_PRIVATE = 'PRI'
export const STATUS_SHARED = 'SHA'
export const STATUS_PUBLIC = 'PUB'
export const STATUS_DELETED = 'DEL'

export default class Collection {
  constructor(
    {
      uid = '',
      name = '',
      description = '',
      labels = ['bucket', 'collection'],
      creationDate = new Date(),
      lastModifiedDate = new Date(),
      creator = null,
      countItems = 0,
      status = STATUS_PRIVATE,
    } = {},
    { complete = false } = {}
  ) {
    this.uid = String(uid)
    this.labels = labels
    this.name = String(name)
    this.description = String(description)
    this.countItems = parseInt(countItems, 10)
    this.creationDate = creationDate instanceof Date ? creationDate : new Date(creationDate)
    this.status = String(status)

    if (lastModifiedDate instanceof Date) {
      this.lastModifiedDate = lastModifiedDate
    } else {
      this.lastModifiedDate = new Date(lastModifiedDate)
    }

    if (creator instanceof User) {
      this.creator = creator
    } else if (creator) {
      this.creator = new User(creator)
    }

    if (!this.uid.length) {
      this.uid = `${this.creator.uid}-${nanoid(8)}` //= > "local-useruid-7hy8hvrX"
    }

    if (complete) {
      // TODO: fill
    }
  }

  static sequelize(client) {
    const creator = User.sequelize(client)
    // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
    // for more of what you can do here.
    const collection = client.define(
      'collection',
      {
        uid: {
          type: DataTypes.STRING(50),
          primaryKey: true,
          unique: true,
          field: 'id',
        },
        name: {
          type: DataTypes.STRING(500),
          allowNull: true,
          defaultValue: '',
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: '',
        },
        status: {
          type: DataTypes.TEXT('tiny'),
          defaultValue: STATUS_PRIVATE,
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
        countItems: {
          type: DataTypes.INTEGER,
          field: 'count_items',
          defaultValue: 0,
        },
        creatorId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'creator_id',
        },
      },
      {
        defaultScope: {
          include: [
            {
              model: creator,
              as: 'creator',
            },
          ],
        },

        scopes: {
          findAll: {
            include: [
              {
                model: creator,
                as: 'creator',
              },
            ],
          },
          get: {
            include: [
              {
                model: creator,
                as: 'creator',
              },
            ],
          },
        },
      }
    )

    collection.belongsTo(creator, {
      as: 'creator',
      foreignKey: {
        fieldName: 'creator_id',
      },
      onDelete: 'CASCADE',
    })

    collection.prototype.toJSON = function (obfuscate = true) {
      const sq = new Collection({
        uid: this.uid,
        name: this.name,
        description: this.description,
        status: this.status,
        creationDate: this.creationDate,
        lastModifiedDate: this.lastModifiedDate,
        countItems: this.countItems,
      })

      if (this.creator) {
        delete sq.creator
      }
      return sq
    }

    return collection
  }
}

module.exports = Collection
module.exports.STATUS_PUBLIC = STATUS_PUBLIC
module.exports.STATUS_PRIVATE = STATUS_PRIVATE
module.exports.STATUS_SHARED = STATUS_SHARED
module.exports.STATUS_DELETED = STATUS_DELETED
