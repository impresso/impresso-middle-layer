const crypto = require('crypto');
const { DataTypes } = require('sequelize');
const User = require('./users.model');

class SearchQuery {
  constructor ({
    uid = '',
    name = '',
    description = '',
    data = '',
    creationDate,
    lastModifiedDate,
    creator,
    countItems = -1,
  }) {
    this.uid = String(uid);
    this.name = String(name);
    this.description = String(description);
    this.data = String(data);
    this.creationDate = creationDate;
    this.lastModifiedDate = lastModifiedDate;
    this.countItems = countItems;

    this.creator = creator;

    if (!this.uid.length) {
      const hash = crypto.createHash('md5').update(this.data).digest('hex');
      this.uid = `${this.creator.uid}-${hash}`; //= > "local-useruid-7hy8hvrX"
    }
  }

  static sequelize (client) {
    const creator = User.sequelize(client);

    const searchQuery = client.define('searchquery', {
      uid: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'id',
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
        type: DataTypes.STRING,
        allowNull: false,
      },
      creationDate: {
        type: DataTypes.DATE,
        field: 'date_created',
        defaultValue: DataTypes.NOW,
      },
      lastModifiedDate: {
        type: DataTypes.DATE,
        field: 'date_last_modified',
        defaultValue: DataTypes.NOW,
      },
      countItems: {
        type: DataTypes.INTEGER,
        field: 'count_items',
        defaultValue: 0,
      },
      creatorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'creator_id',
      },
    }, {
      tableName: 'search_queries',
      defaultScope: {
        include: [
          {
            model: creator,
            as: 'creator',
          },
        ],
      },
    });

    searchQuery.belongsTo(creator, {
      as: 'creator',
      foreignKey: {
        fieldName: 'creator_id',
      },
      onDelete: 'CASCADE',
    });

    searchQuery.prototype.toJSON = function (obfuscate = true) {
      const sq = new SearchQuery({
        uid: this.uid,
        name: this.name,
        data: this.data,
        description: this.description,
        creationDate: this.creationDate,
        lastModifiedDate: this.lastModifiedDate,
        countItems: this.countItems,
      });

      if (this.creator) {
        sq.creator = this.creator.toJSON({
          obfuscate,
        });
      }
      return sq;
    };

    return searchQuery;
  }
}

module.exports = SearchQuery;
