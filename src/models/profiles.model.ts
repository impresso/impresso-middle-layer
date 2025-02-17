import { DataTypes, type Sequelize } from 'sequelize'

export default class Profile {
  uid: string
  picture: string
  pattern: string | string[] = ''
  provider: string
  displayname: string
  emailAccepted?: boolean
  displayName?: string

  constructor({ uid = '', provider = 'local', displayname = '', picture = '', pattern = '' } = {}) {
    this.uid = String(uid)
    this.provider = String(provider)
    this.displayname = String(displayname)
    this.picture = String(picture)
    if (pattern && pattern.length > 0) {
      this.pattern = String(pattern).split(',')
    }
  }

  isValid() {
    return !!this.uid.length
  }

  static sequelize(client: Sequelize) {
    // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
    // for more of what you can do here.
    return client.define('profile', {
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
    })
  }
}
