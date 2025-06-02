import type { Sequelize } from 'sequelize'
import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'

export default class Profile extends Model<InferAttributes<Profile>, InferCreationAttributes<Profile>> {
  declare id: CreationOptional<number>
  declare uid: string
  declare picture: string
  declare provider: string
  declare displayName: string
  declare pattern: string
  declare user_id: number
  declare emailAccepted: boolean
  declare maxLoopsAllowed: number
  declare maxParallelJobs: number
  declare institutionalUrl: string
  declare affiliation: string

  static initModel(client: Sequelize) {
    return Profile.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          unique: true,
        },
        uid: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        provider: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'local',
        },
        displayName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        pattern: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        picture: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        emailAccepted: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          field: 'email_accepted',
        },
        maxLoopsAllowed: {
          type: DataTypes.INTEGER,
          defaultValue: 100,
          field: 'max_loops_allowed',
        },
        maxParallelJobs: {
          type: DataTypes.INTEGER,
          defaultValue: 2,
          field: 'max_parallel_jobs',
        },
        institutionalUrl: {
          type: DataTypes.STRING(200),
          allowNull: true,
          field: 'institutional_url',
        },
        affiliation: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
      },
      {
        sequelize: client,
        tableName: 'profiles',
      }
    )
  }
}
