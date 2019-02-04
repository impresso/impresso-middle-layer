const { DataTypes } = require('sequelize');


class Profile {
  constructor({
    uid = '',
    provider = 'local',
    displayname = '',
    picture = '',
    pattern = '',
  } = {}) {
    this.uid = String(uid);
    this.provider = String(provider);
    this.displayname = String(displayname);
    this.picture = String(picture);
    if (pattern && pattern.length > 0) {
      this.pattern = String(pattern).split(',');
    }
  }
  isValid() {
    return !!this.uid.length;
  }
  static sequelize(client) {
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
    });
  }
}

module.exports = Profile;
