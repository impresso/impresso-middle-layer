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

  constructor({
    uid = 'local',
    provider = 'local',
    displayName = '',
    picture = '',
    pattern = '',
    user_id = 0,
    emailAccepted = false,
    maxLoopsAllowed = 100,
    maxParallelJobs = 2,
    institutionalUrl = '',
    affiliation = '',
  }: {
    id?: number
    uid?: string
    provider?: string
    displayName?: string
    picture?: string
    pattern?: string
    user_id?: number
    emailAccepted?: boolean
    maxLoopsAllowed?: number
    maxParallelJobs?: number
    institutionalUrl?: string
    affiliation?: string
  } = {}) {
    super()
    this.uid = uid
    this.provider = provider
    this.displayName = displayName
    this.picture = picture
    this.pattern = pattern
    this.user_id = user_id
    this.emailAccepted = emailAccepted
    this.maxLoopsAllowed = maxLoopsAllowed
    this.maxParallelJobs = maxParallelJobs
    this.institutionalUrl = institutionalUrl
    this.affiliation = affiliation
  }

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

// export default class Profile {
//   uid: string
//   picture: string
//   pattern: string | string[] = ''
//   provider: string
//   displayname: string
//   emailAccepted?: boolean
//   displayName?: string

//   constructor({ uid = '', provider = 'local', displayname = '', picture = '', pattern = '' } = {}) {
//     this.uid = String(uid)
//     this.provider = String(provider)
//     this.displayname = String(displayname)
//     this.picture = String(picture)
//     if (pattern && pattern.length > 0) {
//       this.pattern = String(pattern).split(',')
//     }
//   }

//   isValid() {
//     return !!this.uid.length
//   }

//   static sequelize(client: Sequelize) {
//     // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
//     // for more of what you can do here.
//     return client.define('profile', {
//       uid: {
//         type: DataTypes.STRING,
//         allowNull: false,
//         unique: true,
//       },
//       provider: {
//         type: DataTypes.STRING,
//         allowNull: false,
//         defaultValue: 'local',
//       },
//       displayName: {
//         type: DataTypes.STRING,
//         allowNull: true,
//       },
//       pattern: {
//         type: DataTypes.STRING,
//         allowNull: true,
//       },
//       picture: {
//         type: DataTypes.STRING,
//         allowNull: true,
//       },
//       user_id: {
//         type: DataTypes.INTEGER,
//         allowNull: false,
//       },
//       emailAccepted: {
//         type: DataTypes.BOOLEAN,
//         defaultValue: false,
//         field: 'email_accepted',
//       },
//       maxLoopsAllowed: {
//         type: DataTypes.INTEGER,
//         defaultValue: 100,
//         field: 'max_loops_allowed',
//       },
//       maxParallelJobs: {
//         type: DataTypes.INTEGER,
//         defaultValue: 2,
//         field: 'max_parallel_jobs',
//       },
//       institutionalUrl: {
//         type: DataTypes.STRING,
//         allowNull: true,
//         field: 'institutional_url',
//         length: 200,
//       },
//       affiliation: {
//         type: DataTypes.STRING,
//         allowNull: true,
//       },
//     })
//   }
// }
