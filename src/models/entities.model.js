const { DataTypes } = require('sequelize');
const entitiesIndex = require('../data')('entities');

const TYPES = {
  50: 'person',
  54: 'location',
};


class Entity {
  constructor({
    uid = '',
    name = '',
    wikidataId = null,
    dbpediaURL = null,
    impressoId = null,
    type = 'entity',
    countItems = -1,
    countMentions = -1,
  } = {}) {
    this.uid = String(uid);
    this.name = String(name);
    this.type = TYPES[String(type)];
    if (!this.type) {
      this.type = String(type);
    }
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
      type: {
        type: DataTypes.SMALLINT,
        field: 'type_id',
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

  static solrFactory() {
    return doc => new Entity({
      uid: doc.id,
      name: doc.l_s.strip('_').join(' '),
      type: doc.t_s,
      countItems: doc.article_fq_f,
      countMentions: doc.mention_fq_f,
    });
  }
}

const SOLR_FL = [
  'id',
  'l_s',
  'article_fq_f',
  'mention_fq_f',
  't_s',
  'entitySuggest',
];

module.exports = Entity;
module.exports.SOLR_FL = SOLR_FL;
