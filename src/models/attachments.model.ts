import type { ModelStatic, Sequelize } from 'sequelize'
import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize'

import Job from './jobs.model'

/**
 * Database model interface for attachments.
 */
export interface IAttachment {
  id: number
  path: string
  createdDate: Date
  lastModifiedDate: Date
  jobId: number
}

export default class Attachment extends Model<InferAttributes<Attachment>, InferCreationAttributes<Attachment>> {
  declare id: CreationOptional<number>
  declare path: string
  declare createdDate: CreationOptional<Date>
  declare lastModifiedDate: CreationOptional<Date>
  declare jobId: ForeignKey<Job['id']>

  // Associations
  declare job?: Job

  toJSON(): Record<string, unknown> {
    const data = this.get()
    return {
      id: data.id,
      path: data.path,
      createdDate: data.createdDate,
      lastModifiedDate: data.lastModifiedDate,
      jobId: data.jobId,
      job: this.job ? (this.job as any).toJSON?.() : null,
    }
  }

  private static get jobModel(): ModelStatic<Model> {
    return Job as unknown as ModelStatic<Model>
  }

  static initialize(sequelize: Sequelize) {
    return Attachment.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          unique: true,
        },
        path: {
          type: DataTypes.STRING,
          field: 'upload',
        },
        createdDate: {
          type: DataTypes.DATE,
          field: 'date_created',
          defaultValue: DataTypes.NOW,
        },
        lastModifiedDate: {
          type: DataTypes.DATE,
          field: 'date_last_modified',
          defaultValue: DataTypes.NOW,
        },
        jobId: {
          type: DataTypes.INTEGER,
          field: 'job_id',
          references: {
            model: this.jobModel,
            key: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      },
      {
        sequelize,
        tableName: 'attachments',
        modelName: 'Attachment',
        underscored: true,
        timestamps: false,
      }
    )
  }

  static associate() {
    Attachment.belongsTo(this.jobModel, {
      as: 'job',
      foreignKey: 'job_id',
      targetKey: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    })
  }
}
