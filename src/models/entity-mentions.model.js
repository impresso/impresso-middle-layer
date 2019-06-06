const { DataTypes } = require('sequelize');

const AS_PERSON = 'pers';

class EntityMention {
  constructor({
    id = '',
    // entity = null,
    // article = null,
    surface = '',
    offsetStart = 0,
    offsetLength = 0,
    confidence = '',
    type = '',
    name = '',
    firstname = '',
    surname = '',
    title = '',
    fn = '',
    qualifier = '',
    demonym = '',
  } = {}) {
    this.id = parseInt(id, 10);
    this.type = String(type);
    this.name = String(name);
    this.t = String(surface);
    this.l = parseInt(offsetStart, 10);
    this.r = this.l + parseInt(offsetLength, 10);
    this.confidence = confidence;

    if (type === AS_PERSON) {
      this.type = 'person';
      this.firstname = String(firstname);
      this.surname = String(surname);
      this.fn = String(fn);
      this.title = String(title);
      this.qualifier = String(qualifier);
      this.demonym = String(demonym);
    }
  }

  static sequelize(client, {
    tableName = 'mentions_v',
  } = {}) {
    const entityMention = client.define('entityMention', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        unique: true,
      },
      offsetStart: {
        type: DataTypes.INTEGER,
        field: 'start_offset',
      },
      offsetLength: {
        type: DataTypes.INTEGER,
        field: 'length',
      },
      confidence: {
        type: DataTypes.STRING(10),
      },
      type: {
        type: DataTypes.STRING(500),
        field: 'label',
      },
      name: {
        type: DataTypes.STRING(500),
      },
      surface: {
        type: DataTypes.STRING(500),
      },
      // person specific
      firstname: {
        type: DataTypes.STRING(500),
      },
      surname: {
        type: DataTypes.STRING(500),
      },
      title: {
        type: DataTypes.STRING(500),
      },
      fn: {
        type: DataTypes.STRING(500),
        field: 'function',
      },
      qualifier: {
        type: DataTypes.STRING(500),
      },
      demonym: {
        type: DataTypes.STRING(500),
      },
    }, {
      tableName,
    });

    entityMention.prototype.toJSON = function () {
      return new EntityMention({
        ...this.get(),
      });
    };

    return entityMention;
  }
}


module.exports = EntityMention;
