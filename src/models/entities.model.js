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
    tableName = 'entities',
  } = {}) {
    const entity = client.define('entity', {
      uid: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        unique: true,
        field: 'id',
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
