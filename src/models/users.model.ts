const config = require('@feathersjs/configuration')()()
import { Sequelize, DataTypes, ModelDefined } from 'sequelize'
import { encrypt } from '../crypto'
import UserBitmap from './user-bitmap.model'
import Group from './groups.model'
import Profile from './profiles.model'

const CRYPTO_ITERATIONS = 180000
interface ObfuscatedUserAttributes {
  uid: string
  username: string
  bitmap?: string
}

export class ObfuscatedUser {
  uid: string
  username: string
  bitmap?: string

  constructor({ uid = '', username = '', bitmap }: Partial<ObfuscatedUserAttributes> = {}) {
    this.uid = uid
    this.username = username
    this.bitmap = bitmap
  }
}

// Define the attributes for the Group model
export interface UserAttributes {
  id: number
  email: string
  uid: string
  username: string
  firstname: string
  lastname: string
  password: string
  isStaff: boolean
  isActive: boolean
  isSuperuser: boolean
  creationDate: Date
  profile: Profile
  groups: Group[]
  userBitmap?: UserBitmap
  bitmap?: string
  toJSON: (params?: { obfuscate?: boolean; groups?: Group[] }) => UserAttributes
}

// Define the creation attributes for the Group model
export interface UserCreationAttributes extends Omit<UserAttributes, 'id'> {}

export default class User {
  id: number | string
  email?: string
  uid: string
  username: string
  firstname: string
  lastname: string
  password: string
  isStaff: boolean
  isActive: boolean
  isSuperuser: boolean
  creationDate: Date | string
  profile: Profile
  groups: Group[]
  bitmap?: string

  constructor({
    id = 0,
    uid = '',
    firstname = '',
    lastname = '',
    // encrypted password
    password = '',
    username = '',
    isStaff = false,
    isActive = false,
    isSuperuser = false,
    profile = new Profile(),
    creationDate = new Date(),
    groups = [],
    bitmap,
  }: Partial<UserAttributes> = {}) {
    this.id = typeof id === 'number' ? id : parseInt(id, 10)
    this.username = String(username)
    this.firstname = String(firstname)
    this.lastname = String(lastname)
    this.password = String(password)

    this.isStaff = Boolean(isStaff)
    this.isActive = Boolean(isActive)
    this.isSuperuser = Boolean(isSuperuser)

    if (profile instanceof Profile) {
      this.profile = profile
    } else {
      this.profile = new Profile(profile)
    }

    if (this.profile.isValid()) {
      this.uid = this.profile.uid
    } else {
      this.uid = String(uid)
    }
    this.creationDate = creationDate instanceof Date ? creationDate : new Date(creationDate)
    this.groups = groups
    this.bitmap = bitmap
  }

  static getMe({ user, profile }: { user: User; profile: Profile }) {
    return {
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      uid: profile.uid,
      username: user.username,
      isActive: user.isActive,
      isStaff: user.isStaff,
      picture: profile.picture,
      pattern: profile.pattern,
      creationDate: user.creationDate,
      emailAccepted: profile.emailAccepted,
      displayName: profile.displayName,
      bitmap: user.bitmap,
      groups: user.groups,
    }
  }

  static buildPassword(
    {
      password = '',
      salt = '',
      iterations = CRYPTO_ITERATIONS,
    }: { password?: string; salt?: string; iterations?: number } = ({} = {})
  ) {
    const pwd = User.encryptPassword({
      password,
      salt,
      iterations,
    })
    return ['pbkdf2_sha256', iterations || CRYPTO_ITERATIONS, pwd.salt, pwd.password].join('$')
  }

  static encryptPassword({
    password = '',
    salt = '',
    iterations = CRYPTO_ITERATIONS,
  }: { password?: string; salt?: string; iterations?: number } = {}) {
    return encrypt(password, {
      salt,
      iterations: iterations || CRYPTO_ITERATIONS,
      length: 32,
      formatPassword: (p: string) => p, // identity, do not format
      encoding: 'base64',
      digest: 'sha256',
    })
  }

  // true or false.
  static comparePassword({
    encrypted = '',
    password = '',
  }: {
    encrypted?: string
    password?: string
  } = {}) {
    if (!encrypted.length) {
      return false
    }

    const parts = encrypted.split('$')

    if (parts.length !== 4) {
      return false
    }

    const result = User.encryptPassword({
      salt: parts[2],
      iterations: parseInt(parts[1], 10),
      password,
    })
    return result.password === parts[3]
  }

  static sequelize(client: Sequelize) {
    const profile = Profile.sequelize(client)
    const userBitmap = UserBitmap.sequelize(client)
    const group = Group.initModel(client)
    // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
    // for more of what you can do here.
    const user: ModelDefined<UserAttributes, UserCreationAttributes> = client.define(
      'user',
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          unique: true,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        password: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        firstname: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: '',
          field: 'first_name',
        },
        lastname: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: '',
          field: 'last_name',
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          field: 'is_active',
        },
        isStaff: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          field: 'is_staff',
        },
        isSuperuser: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          field: 'is_superuser',
        },
        creationDate: {
          type: DataTypes.DATE,
          field: 'date_joined',
          defaultValue: DataTypes.NOW,
        },
      },
      {
        tableName: config.sequelize.tables.users,
        defaultScope: {
          include: [
            {
              model: profile,
              as: 'profile',
            },
            {
              model: userBitmap,
              as: 'userBitmap',
            },
          ],
        },
        scopes: {
          isActive: {
            where: {
              isActive: true,
            },
          },
          get: {
            include: [
              {
                model: profile,
                as: 'profile',
              },
            ],
          },
          find: {
            include: [
              {
                model: profile,
                as: 'profile',
              },
            ],
          },
        },
      }
    )

    user.prototype.toJSON = function (params: { obfuscate?: boolean; groups?: Group[]; userBitmap?: UserBitmap } = {}) {
      const { obfuscate = false, groups = [], userBitmap } = params
      if (obfuscate) {
        const { profile, username } = this as unknown as User
        return new ObfuscatedUser({
          uid: profile.uid,
          username,
          bitmap: params.userBitmap?.bitmap as string,
        })
      }
      return new User({
        ...this.get(),
        groups,
        bitmap: params.userBitmap?.bitmap as string,
      })
    }

    user.hasOne(profile, {
      foreignKey: {
        field: 'user_id',
      },
    })
    user.hasOne(userBitmap, {
      foreignKey: {
        field: 'user_id',
      },
    })
    user.belongsToMany(group, {
      as: 'groups',
      through: 'auth_user_groups',
      foreignKey: 'user_id',
      otherKey: 'group_id', // replaces `categoryId`
    })

    return user
  }
}
