/**
 * Database content item model.
 */

import { DataTypes, ModelDefined, Sequelize } from 'sequelize'
import { ImpressoApplication } from '../types'
import Collection from './collections.model'
import CollectableItem from './collectable-items.model'
import ContentItemPage from './content-item-page.model'

interface ContentItemAttributes {
  uid: string
  v: string
  creationDate: Date
  pages?: ContentItemPage[]
}

export type ContentItemDbModel = ModelDefined<ContentItemAttributes, Omit<ContentItemAttributes, 'id'>>

export default class ContentItem implements ContentItemAttributes {
  uid: string
  v: string
  creationDate: Date
  pages: ContentItemPage[]

  constructor({ uid, v, creationDate, pages }: ContentItemAttributes) {
    this.uid = uid
    this.v = v
    this.creationDate = creationDate
    this.pages = pages ?? []
  }

  static sequelize(client: Sequelize, app: ImpressoApplication) {
    const page = ContentItemPage.sequelize(client)
    const collection = Collection.sequelize(client)
    const collectableItem = CollectableItem.sequelize(client)

    const contentItem = client.define(
      'contentItem',
      {
        uid: {
          type: DataTypes.STRING(50),
          primaryKey: true,
          field: 'id',
          unique: true,
        },
        v: {
          type: DataTypes.STRING(50),
          field: 's3_version',
        },
        creationDate: {
          type: DataTypes.DATE,
          field: 'created',
        },
      },
      {
        tableName: 'content_items',
        scopes: {
          pages: {
            include: [
              {
                model: page,
                as: 'pages',
              },
            ],
          },
          collections: {
            include: [
              {
                model: collection,
                as: 'collections',
              },
            ],
          },
        },
      }
    ) satisfies ContentItemDbModel

    contentItem.belongsToMany(collection, {
      as: 'collections',
      through: collectableItem,
      foreignKey: 'item_id',
      otherKey: 'collection_id',
    })

    contentItem.belongsToMany(page, {
      as: 'pages',
      through: 'page_contentItem',
      foreignKey: 'content_item_id',
      otherKey: 'page_id',
    })

    contentItem.prototype.toJSON = function () {
      return new ContentItem({
        ...this.get(),
      })
    }

    return contentItem
  }
}
