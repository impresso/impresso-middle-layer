import { DataTypes, Model, Sequelize } from 'sequelize'
import type { ContentItem, EntityDetails, EntityMention as IEntityMention } from '@/models/generated/schemas.d.js'
import { EntityCodes } from '@/utils/entity.utils.js'

// https://github.com/impresso/impresso-master-db/blob/master/impresso_db/models/enums.py#L179-L184

interface IEntityMentionDbRecord {
  startOffset: number
  length: number
  surface: string
  name?: string
  confidenceNel: number
  confidenceNer: number
  type: keyof typeof EntityCodes
  entityId: string
  ciId: string
}

class EntityMention implements IEntityMention {
  entityId: string
  ciId: string
  type: EntityDetails['type']
  name?: string
  t: string
  l: number
  r: number
  confidenceNel?: number
  confidenceNer?: number
  contentItem?: ContentItem
  context?: string

  constructor({
    startOffset,
    length,
    confidenceNel,
    confidenceNer,
    name,
    surface,
    type,
    entityId,
    ciId,
  }: IEntityMentionDbRecord) {
    this.entityId = String(entityId)
    this.ciId = String(ciId)
    this.type = EntityCodes[type]

    this.name = name
    this.t = String(surface)
    this.l = parseInt(String(startOffset), 10)
    this.r = this.l + parseInt(String(length), 10)
    this.confidenceNel = confidenceNel
    this.confidenceNer = confidenceNer
  }

  static sequelize(client: Sequelize, { tableName = 'mentions' } = {}) {
    const entityMention = client.define<Model<IEntityMentionDbRecord>>(
      'entityMention',
      {
        startOffset: {
          type: DataTypes.INTEGER,
          field: 'start_offset',
        },
        length: {
          type: DataTypes.INTEGER,
          field: 'length',
        },
        surface: {
          type: DataTypes.STRING(500),
        },
        name: {
          type: DataTypes.STRING(500),
        },
        confidenceNel: {
          type: DataTypes.DOUBLE,
          field: 'confidence_nel',
        },
        confidenceNer: {
          type: DataTypes.DOUBLE,
          field: 'confidence_ner',
        },
        type: {
          type: DataTypes.SMALLINT,
          field: 'type_id',
        },
        entityId: {
          type: DataTypes.STRING(255),
          field: 'entity_id',
        },
        ciId: {
          type: DataTypes.STRING(50),
          field: 'ci_id',
        },
      },
      { tableName }
    )

    entityMention.prototype.toJSON = function () {
      return new EntityMention({
        ...this.get(),
      })
    }

    return entityMention
  }
}

export { IEntityMention }
export default EntityMention
