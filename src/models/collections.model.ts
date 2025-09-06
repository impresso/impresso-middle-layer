import User from './users.model'
import { nanoid } from 'nanoid'
import { BaseUser, Collection as ICollection } from './generated/schemas'
import { ModelDefined, Sequelize } from 'sequelize'

const { DataTypes } = require('sequelize')

export const STATUS_PRIVATE = 'PRI'
export const STATUS_SHARED = 'SHA'
export const STATUS_PUBLIC = 'PUB'
export const STATUS_DELETED = 'DEL'

type IDBCollection = Omit<ICollection, 'creationDate' | 'lastModifiedDate' | 'creator'> & {
  creator?: User
  creationDate: Date
  lastModifiedDate: Date
}

export type CollectionDbModel = ModelDefined<IDBCollection, Omit<IDBCollection, 'uid'>>

export default class Collection implements IDBCollection {
  uid: string
  name: string
  description: string
  status: string
  labels: string[]
  creationDate: Date
  lastModifiedDate: Date
  countItems: number
  creator?: User

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
    this.countItems = typeof countItems === 'string' ? parseInt(countItems, 10) : countItems
    this.creationDate = creationDate instanceof Date ? creationDate : new Date(creationDate)
    this.status = String(status)

    if (lastModifiedDate instanceof Date) {
      this.lastModifiedDate = lastModifiedDate
    } else {
      this.lastModifiedDate = new Date(lastModifiedDate)
    }

    if (creator != null && (creator as any) instanceof User) {
      this.creator = creator
    } else if (creator) {
      this.creator = new User(creator)
    }

    if (!this.uid.length) {
      this.uid = `${this.creator?.uid}-${nanoid(8)}` //= > "local-useruid-7hy8hvrX"
    }

    if (complete) {
      // TODO: fill
    }
  }

  toJSON(): Omit<ICollection, 'creator'> & Partial<Pick<ICollection, 'creator'>> {
    return {
      countItems: this.countItems,
      creator: this.creator
        ? {
            uid: this.creator.uid,
            username: this.creator.username,
          }
        : undefined,
      description: this.description,
      lastModifiedDate: this.lastModifiedDate.toISOString(),
      creationDate: this.creationDate.toISOString(),
      labels: this.labels,
      name: this.name,
      status: this.status,
      uid: this.uid,
    }
  }

  static sequelize(client: Sequelize) {
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
      foreignKey: 'creator_id',
      onDelete: 'CASCADE',
    })

    collection.prototype.toJSON = function () {
      return new Collection(this.get())
    }

    return collection
  }
}
