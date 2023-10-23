const config = require('@feathersjs/configuration')()();
const { DataTypes } = require('sequelize');
const { encrypt } = require('../crypto');

const Profile = require('./profiles.model');
const Group = require('./groups.model');

const CRYPTO_ITERATIONS = 180000;

class ObfuscatedUser {
  constructor ({
    uid = '',
    username = '',
  } = {}) {
    this.uid = String(uid);
    this.username = String(username);
  }
}

class User {
  constructor ({
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
    groups = [],
  } = {}) {
    this.id = parseInt(id, 10);
    this.username = String(username);
    this.firstname = String(firstname);
    this.lastname = String(lastname);
    this.password = String(password);

    this.isStaff = Boolean(isStaff);
    this.isActive = Boolean(isActive);
    this.isSuperuser = Boolean(isSuperuser);

    if (profile instanceof Profile) {
      this.profile = profile;
    } else {
      this.profile = new Profile(profile);
    }

    if (this.profile.isValid()) {
      this.uid = this.profile.uid;
    } else {
      this.uid = String(uid);
    }
    this.groups = groups;
  }

  static getMe ({ user, profile }) {
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
    };
  }

  static buildPassword ({
    password, salt, iterations,
  } = {}) {
    const pwd = User.encryptPassword({
      password, salt, iterations,
    });
    return [
      'pbkdf2_sha256', iterations || CRYPTO_ITERATIONS,
      pwd.salt, pwd.password,
    ].join('$');
  }

  static encryptPassword ({
    password, salt, iterations,
  } = {}) {
    return encrypt(password, {
      salt,
      iterations: iterations || CRYPTO_ITERATIONS,
      length: 32,
      formatPassword: p => p, // identity, do not format
      encoding: 'base64',
      digest: 'sha256',
    });
  }

  // true or false.
  static comparePassword ({
    encrypted = '',
    password = '',
  } = {}) {
    if (!encrypted.length) {
      return false;
    }

    const parts = encrypted.split('$');

    if (parts.length !== 4) {
      return false;
    }

    const result = User.encryptPassword({
      salt: parts[2],
      iterations: parseInt(parts[1], 10),
      password,
    });
    return result.password === parts[3];
  }

  static sequelize (client) {
    const profile = Profile.sequelize(client);
    const group = Group.sequelize(client);
    // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
    // for more of what you can do here.
    const user = client.define('user', {
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
    }, {
      tableName: config.sequelize.tables.users,
      defaultScope: {
        include: [
          {
            model: profile,
            as: 'profile',
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
    });

    user.prototype.toJSON = function ({
      obfuscate = false,
      groups = [],
    } = {}) {
      if (obfuscate) {
        return new ObfuscatedUser({
          uid: this.profile.uid,
          username: this.username,
        });
      }
      return new User({
        ...this.get(),
        groups,
      });
    };

    user.hasOne(profile, {
      foreignKey: {
        fieldName: 'user_id',
      },
    });
    user.belongsToMany(group, {
      as: 'groups',
      through: 'auth_user_groups',
      foreignKey: {
        fieldName: 'user_id',
      },
      otherKey: {
        fieldName: 'group_id',
      }, // replaces `categoryId`
    });

    return user;
  }
}

module.exports = User;
