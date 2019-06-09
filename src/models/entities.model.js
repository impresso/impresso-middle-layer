const { DataTypes } = require('sequelize');

class Entity {
  constructor({
    id = 0,
    name = '',
    wikidataId = null,
    dbpediaURL = null,
    impressoId = null,
    type = 'entity',
    countItems = -1,
    countMentions = -1,
  } = {}) {
    this.id = parseInt(id, 10);
    this.name = String(name);
    this.type = String(type);
    this.wikidataId = wikidataId;
    this.dbpediaURL = dbpediaURL;
    this.impressoId = impressoId;
    this.countItems = parseInt(countItems || 0, 10);
    this.countMentions = parseInt(countMentions || 0, 10);
  }

  static sequelize(client, {
    tableName = 'entities_v',
  } = {}) {
    const entity = client.define('entity', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(255),
        field: 'master_label',
      },
      wikidataId: {
        type: DataTypes.STRING(20),
        field: 'wkd_id',
      },
      dbpediaURL: {
        type: DataTypes.STRING(255),
        field: 'dbp_url',
      },
      impressoId: {
        type: DataTypes.STRING(255),
        field: 'imp_id',
      },
      countItems: {
        // number of contentitems matching
        type: DataTypes.INTEGER,
        field: 'item_count',
      },
      countMentions: {
        type: DataTypes.INTEGER,
        field: 'mention_count',
      },
      // startDate: {
      //  // one day
      // },
      // endDate: {
      //
      // }
    }, {
      tableName,
    });

    entity.prototype.toJSON = function () {
      return new Entity({
        ...this.get(),
      });
    };

    return entity;
  }
}


module.exports = Entity;
