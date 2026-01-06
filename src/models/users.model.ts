import { Sequelize, DataTypes, ModelDefined, CreationOptional } from 'sequelize'
import { encrypt } from '@/crypto.js'
import UserBitmap, { BufferUserPlanGuest } from '@/models/user-bitmap.model.js'
import Group from '@/models/groups.model.js'
import Profile from '@/models/profiles.model.js'
import { bigIntToBase64Bytes } from '@/util/bigint.js'

const CRYPTO_ITERATIONS = 180000

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
  lastLogin: Date | null
  profile: Profile
  groups: Group[]
  userBitmap?: UserBitmap
  bitmap?: bigint
  toJSON: (params?: { obfuscate?: boolean; groups?: Group[] }) => UserAttributes
}

/**
 * Serialised version of User ready to be sent over the wire.
 */
export interface Me {
  firstname: string
  lastname: string
  email: string
  uid: string
  isActive: boolean
  isStaff: boolean
  picture: string
  pattern: string
  creationDate: Date
  lastLogin: Date | null
  emailAccepted: boolean
  bitmap?: string
  groups: Group[]
  affiliation: string
  institutionalUrl: string
}

// Define the creation attributes for the Group model
export interface UserCreationAttributes extends Omit<UserAttributes, 'id'> {}

export default class User {
  declare id: CreationOptional<number>

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
  lastLogin: Date | string | null
  profile: Profile
  groups: Group[]
  bitmap?: bigint

  constructor({
    id,
    uid = '',
    firstname = '',
    lastname = '',
    email = '',
    // encrypted password
    password = '',
    username = '',
    isStaff = false,
    isActive = false,
    isSuperuser = false,
    profile = new Profile(),
    creationDate = new Date(),
    lastLogin = null,
    groups = [],
    bitmap,
  }: Partial<UserAttributes> = {}) {
    if (typeof id === 'number') {
      this.id = id
    }
    this.username = String(username)
    this.firstname = String(firstname)
    this.lastname = String(lastname)
    this.password = String(password)
    this.email = String(email)
    this.isStaff = Boolean(isStaff)
    this.isActive = Boolean(isActive)
    this.isSuperuser = Boolean(isSuperuser)

    if (profile instanceof Profile) {
      this.profile = profile
    } else {
      this.profile = new Profile(profile)
    }
    this.uid = String(uid)
    if (!uid.length && this.profile.uid) {
      this.uid = this.profile.uid
    }
    this.creationDate = creationDate instanceof Date ? creationDate : new Date(creationDate)
    this.lastLogin = lastLogin instanceof Date ? lastLogin : null
    this.groups = groups
    this.bitmap = bitmap ?? BufferUserPlanGuest
  }

  static getMe({ user, profile }: { user: User; profile: Profile }): Me {
    return {
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email || '',
      uid: profile.uid,
      isActive: user.isActive,
      isStaff: user.isStaff,
      picture: profile.picture,
      pattern: profile.pattern,
      creationDate: user.creationDate as Date,
      lastLogin: user.lastLogin as Date,
      emailAccepted: profile.emailAccepted,
      bitmap: user.bitmap != null ? bigIntToBase64Bytes(user.bitmap) : undefined,
      groups: user.groups,
      affiliation: profile.affiliation || '',
      institutionalUrl: profile.institutionalUrl || '',
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
    const profile = Profile.initModel(client)
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
        lastLogin: {
          type: DataTypes.DATE,
          field: 'last_login',
          allowNull: true,
          defaultValue: null,
        },
      },
      {
        tableName: 'auth_user',
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
      const { groups = [], userBitmap } = params
      return new User({
        ...this.get(),
        groups,
        bitmap: userBitmap?.bitmap ?? BufferUserPlanGuest,
      })
    }

    user.hasOne(profile, {
      as: 'profile',
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
