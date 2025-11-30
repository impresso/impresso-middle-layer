import type { ModelStatic, Sequelize } from 'sequelize'
import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize'

import User from './users.model'
import Attachment from './attachments.model'

export type JobType = 'BCQ' | 'DCO' | 'IDX' | 'EXP' | 'EXC'

export const TYPE_BULK_COLLECTION_FROM_QUERY = 'BCQ' satisfies JobType
export const TYPE_DELETE_COLLECTION = 'DCO' satisfies JobType
export const TYPE_SYNC_COLLECTION_TO_SOLR = 'IDX' satisfies JobType
export const TYPE_EXPORT = 'EXP' satisfies JobType
export const TYPE_EXPORT_COLLECTION = 'EXC' satisfies JobType

export type Status = 'REA' | 'RUN' | 'DON' | 'ERR' | 'ARC' | 'STO' | 'RIP'

export const STATUS_READY = 'REA' satisfies Status
export const STATUS_RUN = 'RUN' satisfies Status
export const STATUS_DONE = 'DON' satisfies Status
export const STATUS_ERR = 'ERR' satisfies Status
export const STATUS_ARCHIVED = 'ARC' satisfies Status
export const STATUS_STOPPING = 'STO' satisfies Status
export const STATUS_KILLED = 'RIP' satisfies Status

/**
 * Database model interface for jobs.
 */
export interface IJob {
  id: number
  type: JobType
  status: Status
  description: string
  creationDate: Date
  lastModifiedDate: Date
  extra?: Record<string, unknown> | null
  creatorId: number
}

export default class Job extends Model<InferAttributes<Job>, InferCreationAttributes<Job>> {
  declare id: CreationOptional<number>
  declare type: JobType
  declare status: Status
  declare description: string
  declare creationDate: CreationOptional<Date>
  declare lastModifiedDate: CreationOptional<Date>
  declare extra: Record<string, unknown> | null
  declare creatorId: ForeignKey<User['id']>

  // Associations
  declare creator?: User
  declare attachment?: Attachment

  toJSON(obfuscate: boolean = true): Record<string, unknown> {
    const data = this.get()
    return {
      id: data.id,
      type: data.type,
      description: data.description,
      status: data.status,
      creationDate: data.creationDate,
      lastModifiedDate: data.lastModifiedDate,
      extra: data.extra,
      attachment: this.attachment ? (this.attachment as any).toJSON?.() : null,
      creator: this.creator ? (this.creator as any).toJSON?.({ obfuscate }) : null,
    }
  }

  static initialize(sequelize: Sequelize) {
    const userModel = User.sequelize(sequelize)
    const attachmentModel = Attachment.initialize(sequelize)

    const initializedJobModel = Job.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          unique: true,
        },
        type: {
          type: DataTypes.CHAR(3),
        },
        status: {
          type: DataTypes.CHAR(3),
          defaultValue: STATUS_READY,
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
        description: {
          type: DataTypes.STRING,
        },
        extra: {
          type: DataTypes.JSON,
          allowNull: true,
          get() {
            const value = this.getDataValue('extra')
            // If it's a string, parse it. Otherwise, return it as is.
            if (typeof value === 'string') {
              try {
                return JSON.parse(value)
              } catch (e) {
                // Handle malformed JSON if necessary, maybe return null or the raw string
                return value
              }
            }
            return value
          },
        },
        creatorId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'creator_id',
          references: {
            model: userModel,
            key: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
      {
        sequelize,
        tableName: 'jobs',
        modelName: 'Job',
        underscored: true,
        timestamps: false,
        defaultScope: {
          include: [
            {
              model: userModel,
              as: 'creator',
            },
            {
              model: attachmentModel,
              as: 'attachment',
            },
          ],
        },
      }
    )

    initializedJobModel.belongsTo(userModel, {
      as: 'creator',
      foreignKey: 'creator_id',
      targetKey: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    })

    initializedJobModel.hasOne(attachmentModel, {
      as: 'attachment',
      foreignKey: 'job_id',
      onDelete: 'CASCADE',
      constraints: false,
    })

    return initializedJobModel
  }
}
