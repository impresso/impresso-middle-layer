import { DataTypes, Sequelize } from 'sequelize'
import { getNameFromUid, getTypeCodeFromUid, TypeCodeToType, TypeShorthandToType } from '../utils/entity.utils'

interface IEntity {
  uid: string
  name: string
  wikidataId?: string
  dbpediaURL?: string
  impressoId?: string
  type: string
  countItems: number
  countMentions: number
}

export default class Entity implements IEntity {
  uid: string
  name: string
  wikidataId?: string
  dbpediaURL?: string
  impressoId?: string
  type: string
  countItems: number = 0
  countMentions: number = 0

  constructor({
    uid = '',
    name = '',
    wikidataId = null,
    dbpediaURL = null,
    impressoId = null,
    type = 'entity',
    countItems = -1,
    countMentions = -1,
  } = {}) {
    this.uid = String(uid)
    if (name.length) {
      this.name = getNameFromUid(name)
    } else {
      this.name = getNameFromUid(uid)
    }

    this.type = TypeCodeToType[String(type)]
    if (!this.type) {
      this.type = String(type).toLowerCase()
    }
    if (wikidataId) {
      this.wikidataId = wikidataId
    }
    if (dbpediaURL) {
      this.dbpediaURL = dbpediaURL
    }
    if (impressoId) {
      this.impressoId = impressoId
    }
    if (countItems !== -1) {
      this.countItems = parseInt(String(countItems ?? 0), 10)
    }
    if (countMentions !== -1) {
      this.countMentions = parseInt(String(countMentions ?? 0), 10)
    }
  }

  static getCached(uid: string) {
    return new Entity({
      uid,
      name: getNameFromUid(uid),
      type: getTypeCodeFromUid(uid),
    })
  }

  static sequelize(client: Sequelize, { tableName = 'entities' } = {}) {
    const entity = client.define(
      'entity',
      {
        uid: {
          type: DataTypes.STRING(255),
          primaryKey: true,
          unique: true,
          field: 'id',
        },
        name: {
          type: DataTypes.STRING(255),
          field: 'master_label',
        },
        wikidataId: {
          type: DataTypes.STRING(20),
          field: 'wkd_id',
        },
        dbpediaURL: {
          type: DataTypes.STRING(255),
          field: 'dbp_url',
        },
        impressoId: {
          type: DataTypes.STRING(255),
          field: 'imp_id',
        },
        type: {
          type: DataTypes.SMALLINT,
          field: 'type_id',
        },
      },
      {
        tableName,
      }
    )

    entity.prototype.toJSON = function () {
      return new Entity({
        ...this.get(),
      })
    }

    return entity
  }

  static solrFactory() {
    return (doc: Record<string, any>) =>
      new Entity({
        uid: doc.id,
        name: (doc.l_s || '').split('_').join(' '),
        type: TypeShorthandToType[doc.t_s?.toLowerCase()] ?? doc.t_s,
        countItems: doc.article_fq_f,
        countMentions: doc.mention_fq_f,
      })
  }
}

export const SOLR_FL = ['id', 'l_s', 'article_fq_f', 'mention_fq_f', 't_s', 'entitySuggest']
