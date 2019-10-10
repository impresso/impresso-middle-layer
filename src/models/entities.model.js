const { DataTypes } = require('sequelize');

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
    if (name.length) {
      this.name = Entity.getNameFromUid(name);
    } else {
      this.name = Entity.getNameFromUid(uid);
    }

    this.type = TYPES[String(type)];
    if (!this.type) {
      this.type = String(type).toLowerCase();
    }
    if (wikidataId) {
      this.wikidataId = wikidataId;
    }
    if (dbpediaURL) {
      this.dbpediaURL = dbpediaURL;
    }
    if (impressoId) {
      this.impressoId = impressoId;
    }
    if (countItems !== -1) {
      this.countItems = parseInt(countItems || 0, 10);
    }
    if (countMentions !== -1) {
      this.countMentions = parseInt(countMentions || 0, 10);
    }
  }

  static getNameFromUid(uid) {
    return uid.replace(/^aida-\d+-\d+-/, '').split('_').join(' ');
  }

  static getTypeFromUid(uid) {
    return uid.replace(/^aida-\d+-(\d+)-.*/, '$1');
  }

  static getCached(uid) {
    return new Entity({
      uid,
      name: Entity.getNameFromUid(uid),
      type: Entity.getTypeFromUid(uid),
    });
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
      name: (doc.l_s || '').split('_').join(' '),
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
