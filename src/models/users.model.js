const { DataTypes } = require('sequelize');
const Profile = require('./profiles.model');
const { encrypt } = require('../crypto');

class User {
  constructor({
    uid = '',
    firstname = '',
    lastname = '',
    // encrypted password
    password = '',
    username = '',
    isStaff = false,
    isActive = false,
    profile = new Profile(),
  } = {}) {
    this.username = String(username);
    this.fisrtname = String(firstname);
    this.lastname = String(lastname);
    this.password = String(password);

    this.isStaff = Boolean(isStaff);
    this.isActive = Boolean(isActive);

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
  }

  static encryptPassword({
    password, salt, iterations,
  } = {}) {
    return encrypt(password, {
      salt,
      iterations: iterations || 120000,
      length: 32,
      formatPassword: p => p, // identity, do not format
      encoding: 'base64',
      digest: 'sha256',
    });
  }
  // true or false.
  static comparePassword({
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

  static sequelize(client, options = {}) {
    const profile = Profile.sequelize(client);
    // See http://docs.sequelizejs.com/en/latest/docs/models-definition/
    // for more of what you can do here.
    const user = client.define('user', {
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
        allowNull: false,
        field: 'first_name',
      },
      lastname: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'last_name',
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      isStaff: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_staff',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_active',
      },
    }, {
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
      ...options,
    });

    user.hasOne(profile, {
      foreignKey: {
        fieldName: 'user_id',
      },
    });
    return user;
  }
}

module.exports = User;
