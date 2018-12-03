const { DataTypes } = require('sequelize');
const User = require('./users.model');

class SearchQuery {
  constructor({
    uid = '',
  } = {}) {
    this.uid = String(uid);
  }

  static sequelize(client) {
    const creator = User.sequelize(client);

    const searchQuery = client.define('searchquery', {
      uid: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      data: {
        type: DataTypes.JSON,
        allowNull: false,
      },
    });

    searchQuery.belongsTo(creator, {
      as: 'creator',
      foreignKey: {
        fieldName: 'creator_id',
      },
      onDelete: 'CASCADE',
    });
    return searchQuery;
  }
}

module.exports = SearchQuery;
