const { DataTypes } = require('sequelize');

class Entity {
  constructor({
    id = '',
    label = '',
    mentions = [],
    wikidataId = '',
    type = 'entity',
  } = {}) {
    this.id = parseInt(id, 10);
    this.label = String(label);
    this.type = String(type);
    this.wikidataId = String(wikidataId);
    this.mentions = mentions;
  }

  static sequelize(client, {
    tableName = 'entities',
  } = {}) {
    const entity = client.define('entity', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        unique: true,
      },
      label: {
        type: DataTypes.STRING(255),
        field: 'master_label',
      },
      wikidataId: {
        type: DataTypes.STRING(20),
        field: 'wkd_id',
      },
      dbpediaURL: {
        type: DataTypes.STRING(255),
        field: 'dpp_url',
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
